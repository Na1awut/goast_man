// send-push: delivers one push_outbox row to every device of its user.
//
// Called only by the database (push_dispatch trigger, through pg_net):
// POST { id } with header x-push-secret. Not for the app; deploy with
// --no-verify-jwt, the shared secret is the check.
//
// Secrets (Supabase → Edge Functions → Secrets), never in the app:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), PUSH_HOOK_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Constant-time compare, so the secret can't be guessed byte by byte */
function sameSecret(a: string, b: string) {
	const x = new TextEncoder().encode(a);
	const y = new TextEncoder().encode(b);
	if (x.length !== y.length) return false;
	let diff = 0;
	for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
	return diff === 0;
}

Deno.serve(async (req) => {
	if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

	const secret = Deno.env.get('PUSH_HOOK_SECRET');
	const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
	const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
	if (!secret || !publicKey || !privateKey) return json({ error: 'PUSH_NOT_CONFIGURED' }, 503);
	if (!sameSecret(req.headers.get('x-push-secret') ?? '', secret)) return json({ error: 'FORBIDDEN' }, 403);

	const id = Number((await req.json().catch(() => ({})))?.id);
	if (!Number.isInteger(id)) return json({ error: 'BAD_REQUEST' }, 400);

	webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:team@goose-man.tech', publicKey, privateKey);
	const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

	const { data: row } = await admin.from('push_outbox').select('*').eq('id', id).is('sent_at', null).maybeSingle();
	if (!row) return json({ ok: true, skipped: true });

	const { data: subs } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', row.user_id);
	const payload = JSON.stringify({ title: row.title, body: row.body, url: row.url, tag: row.tag });

	const errors: string[] = [];
	let delivered = 0;
	for (const s of subs ?? []) {
		try {
			// TTL: a notification older than 10 minutes is no longer useful (jobs get taken, riders arrive)
			await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 600, urgency: 'high' });
			delivered++;
		} catch (err) {
			const status = (err as { statusCode?: number }).statusCode;
			// The browser dropped this subscription (app removed, permission revoked): forget it
			if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
			else errors.push(String(status ?? (err as Error).message).slice(0, 60));
		}
	}

	await admin
		.from('push_outbox')
		.update({ sent_at: new Date().toISOString(), error: errors.length ? errors.join('; ').slice(0, 200) : null })
		.eq('id', id);
	return json({ ok: true, delivered });
});
