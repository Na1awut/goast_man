// verify-slip: a buyer uploads the transfer slip for a PromptPay order. The slip is stored and
// queued at once (the buyer is told "กำลังตรวจสลิป"); SlipOK then checks queued slips a few at a
// time (amount, the team's receiving account, reused slips) and the order is marked paid, which
// puts it on the riders' board. Nothing SlipOK accepted is lost: see migration 20261102.
//
// POST multipart/form-data { order_id, slip: <image> } with the buyer's
//   Authorization: Bearer <access token>   -> 202 { queued: true, submission_id } or { error: CODE }
// POST JSON { kick: <submission_id> } (the buyer, or a team member): runs a queued slip again
//   -> 202 { ok: true }. The buyer's app does this for a slip that has waited too long.
// The result is read by the buyer with my_slip_status(order_id).
//
// Secrets (Supabase -> Edge Functions -> Secrets), never in the app:
//   SLIPOK_API_KEY, SLIPOK_BRANCH_ID
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { verifySlip, type PayableOrder } from './core.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const MAX_SLIP_BYTES = 5 * 1024 * 1024;
/** SlipOK checks running at once, across all buyers */
const SLIPOK_CONCURRENCY = 4;
const BUCKET = 'payment-slips';

const cors = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Errors the queue functions raise, as the codes and statuses the app understands */
const ENQUEUE_ERRORS: Record<string, number> = {
	ORDER_NOT_FOUND: 404,
	ORDER_NOT_PAYABLE: 409,
	ALREADY_PAID: 409,
	SLIP_ALREADY_QUEUED: 409,
	SLIP_UNDER_REVIEW: 409,
	TOO_MANY_ATTEMPTS: 429,
	RATE_LIMITED: 429
};

/** The real type of an upload, from its first bytes, not from the name or the Content-Type the sender claims */
function imageKind(b: Uint8Array): { ext: string; mime: string } | null {
	const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
	if (at(0, 0xff, 0xd8, 0xff)) return { ext: 'jpg', mime: 'image/jpeg' };
	if (at(0, 0x89, 0x50, 0x4e, 0x47)) return { ext: 'png', mime: 'image/png' };
	if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return { ext: 'webp', mime: 'image/webp' };
	if (at(4, 0x66, 0x74, 0x79, 0x70)) return { ext: 'heic', mime: 'image/heic' }; // ISO base media: HEIC/HEIF
	return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Checks one queued slip with SlipOK and records the result. Never throws. */
async function processSubmission(admin: SupabaseClient, id: string, apiKey: string, branchId: string): Promise<void> {
	// Wait for a free SlipOK slot; if none opens, the slip stays queued and is kicked again later
	let claimed = false;
	for (let i = 0; i < 30 && !claimed; i++) {
		const { data } = await admin.rpc('slip_claim', { p_id: id, p_max: SLIPOK_CONCURRENCY });
		if (data === true) {
			claimed = true;
			break;
		}
		const { data: row } = await admin.from('slip_submissions').select('status').eq('id', id).maybeSingle();
		if (!row || row.status !== 'QUEUED') return;
		await sleep(2000);
	}
	if (!claimed) return;

	const finish = (status: string, code?: string, ref?: string) =>
		admin.rpc('slip_finish', { p_id: id, p_status: status, p_code: code ?? null, p_ref: ref ?? null });
	try {
		const { data: sub } = await admin.from('slip_submissions').select('id, order_id, customer_id, image_path').eq('id', id).single();
		if (!sub) return;
		const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(sub.image_path);
		if (downloadError || !blob) {
			await finish('QUEUED', 'STORAGE_ERROR');
			return;
		}
		const slip = new File([blob], 'slip', { type: blob.type || 'image/jpeg' });

		const result = await verifySlip(
			sub.customer_id,
			sub.order_id,
			{
				async getOrder(orderId) {
					const { data } = await admin.from('orders').select('id, customer_id, payment_method, status, paid_at, total_price').eq('id', orderId).maybeSingle();
					return data as PayableOrder | null;
				},
				async checkSlip(amount) {
					const body = new FormData();
					body.append('files', slip);
					body.append('amount', String(amount));
					body.append('log', 'true');
					const res = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
						method: 'POST',
						headers: { 'x-authorization': apiKey },
						body
					});
					return await res.json();
				},
				async recordPayment(orderId, slipRef, amount) {
					const { data, error } = await admin.rpc('record_slip_payment', { p_order_id: orderId, p_slip_ref: slipRef, p_amount: amount });
					if (error) throw new Error(error.message);
					return data as 'PAID' | 'REFUND_DUE';
				}
			},
			{ allowCancelled: true }
		);

		if (result.ok) await finish('PAID', result.refundDue ? 'REFUND_DUE' : undefined, result.ref);
		else if (result.verifiedRef) await finish('NEEDS_REVIEW', result.code, result.verifiedRef);
		else if (result.code === 'SLIPOK_UNAVAILABLE') await finish('QUEUED', result.code);
		else await finish('REJECTED', result.code);
	} catch (err) {
		// Unknown: SlipOK may already have accepted the slip. A person decides; it is never repeated blindly.
		console.error('verify-slip: processing failed', id, err instanceof Error ? err.message : String(err));
		await finish('NEEDS_REVIEW', 'ERROR');
	}
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
	if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

	const apiKey = Deno.env.get('SLIPOK_API_KEY');
	const branchId = Deno.env.get('SLIPOK_BRANCH_ID');
	if (!apiKey || !branchId) return json({ error: 'SLIPOK_NOT_CONFIGURED' }, 503);

	const url = Deno.env.get('SUPABASE_URL')!;
	const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
		global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
	});
	const {
		data: { user }
	} = await userClient.auth.getUser();
	if (!user) return json({ error: 'AUTH_REQUIRED' }, 401);
	const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

	// ---- Kick: run a waiting slip again
	if ((req.headers.get('content-type') ?? '').includes('application/json')) {
		const kick = String((await req.json().catch(() => ({})))?.kick ?? '');
		if (!/^[0-9a-f-]{36}$/i.test(kick)) return json({ error: 'SLIP_INVALID' }, 400);
		const { data: sub } = await admin.from('slip_submissions').select('customer_id, status').eq('id', kick).maybeSingle();
		if (!sub) return json({ error: 'ORDER_NOT_FOUND' }, 404);
		if (sub.customer_id !== user.id) {
			const { data: me } = await userClient.rpc('team_me');
			if (!me) return json({ error: 'ORDER_NOT_FOUND' }, 404);
		}
		if (sub.status === 'QUEUED' || sub.status === 'CHECKING') EdgeRuntime.waitUntil(processSubmission(admin, kick, apiKey, branchId));
		return json({ ok: true }, 202);
	}

	// ---- Upload
	let orderId = '';
	let slip: File | null = null;
	try {
		const form = await req.formData();
		orderId = String(form.get('order_id') ?? '');
		const file = form.get('slip');
		slip = file instanceof File ? file : null;
	} catch {
		return json({ error: 'SLIP_INVALID' }, 400);
	}
	if (!/^[0-9a-f-]{36}$/i.test(orderId) || !slip) return json({ error: 'SLIP_INVALID' }, 400);
	if (slip.size > MAX_SLIP_BYTES) return json({ error: 'SLIP_TOO_LARGE' }, 413);
	const bytes = new Uint8Array(await slip.arrayBuffer());
	const kind = imageKind(bytes);
	if (!kind) return json({ error: 'SLIP_NOT_IMAGE' }, 415);

	// Queue first (it enforces the limits), then keep the image
	const id = crypto.randomUUID();
	const path = `${user.id}/${orderId}/${id}.${kind.ext}`;
	const queued = await admin.rpc('slip_enqueue', { p_id: id, p_order_id: orderId, p_customer_id: user.id, p_path: path });
	if (queued.error) {
		const code = Object.keys(ENQUEUE_ERRORS).find((c) => queued.error.message.includes(c));
		return json({ error: code ?? 'SLIP_NOT_QUEUED' }, code ? ENQUEUE_ERRORS[code] : 500);
	}
	const stored = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: kind.mime, upsert: false });
	if (stored.error) {
		await admin.rpc('slip_finish', { p_id: id, p_status: 'REJECTED', p_code: 'UPLOAD_FAILED', p_ref: null });
		return json({ error: 'UPLOAD_FAILED' }, 502);
	}

	EdgeRuntime.waitUntil(processSubmission(admin, id, apiKey, branchId));
	return json({ queued: true, submission_id: id }, 202);
});
