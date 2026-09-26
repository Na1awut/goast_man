// verify-slip: a buyer uploads the transfer slip for a PromptPay order; SlipOK
// checks it (amount, the team's receiving account, reused slips) and the order
// is marked paid, which puts it on the riders' board.
//
// POST multipart/form-data { order_id, slip: <image> } with the buyer's
// Authorization: Bearer <access token>. Returns { ok: true } or { error: CODE }.
//
// Secrets (Supabase → Edge Functions → Secrets), never in the app:
//   SLIPOK_API_KEY, SLIPOK_BRANCH_ID
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifySlip, type PayableOrder } from './core.ts';

const MAX_SLIP_BYTES = 5 * 1024 * 1024;

const cors = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

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
	if (!orderId || !slip) return json({ error: 'SLIP_INVALID' }, 400);
	if (slip.size > MAX_SLIP_BYTES) return json({ error: 'SLIP_TOO_LARGE' }, 413);

	const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
	const result = await verifySlip(user.id, orderId, {
		async getOrder(id) {
			const { data } = await admin
				.from('orders')
				.select('id, customer_id, payment_method, status, paid_at, total_price')
				.eq('id', id)
				.maybeSingle();
			return data as PayableOrder | null;
		},
		async checkSlip(amount) {
			const body = new FormData();
			body.append('files', slip!);
			body.append('amount', String(amount));
			body.append('log', 'true');
			const res = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
				method: 'POST',
				headers: { 'x-authorization': apiKey },
				body
			});
			return await res.json();
		},
		async recordPayment(id, slipRef, amount) {
			const { error } = await admin.rpc('record_slip_payment', { p_order_id: id, p_slip_ref: slipRef, p_amount: amount });
			if (error) throw new Error(error.message);
		}
	});
	return result.ok ? json({ ok: true, alreadyPaid: !!result.alreadyPaid }) : json({ error: result.code }, result.status);
});
