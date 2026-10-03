// test-login (TEST project ONLY): turns a ticket from the real project's test-ticket into a
// sign-in on the test site, so a real team member needs no password there.
//
// !!! Deploy this to the TEST project only, never the real one. It refuses to run unless the
// secret IS_TEST_PROJECT=true is set, which only the test project has. !!!
//
// POST { ticket }, no login needed (the ticket is the proof). Deploy with --no-verify-jwt.
// Returns { token_hash, next } for the browser to exchange with supabase.auth.verifyOtp
// ({ token_hash, type: 'magiclink' }), or { error: CODE }.
//
// Secrets: SSO_SHARED_SECRET (same as the real project), IS_TEST_PROJECT=true
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Needs supabase/test-site/sso.sql applied to the test database.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { FIXED_TEST_ACCOUNTS, verifyTicket } from '../_shared/ticket.ts';

const cors = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
	if (Deno.env.get('IS_TEST_PROJECT') !== 'true') return json({ error: 'NOT_FOUND' }, 404);
	if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

	const secret = Deno.env.get('SSO_SHARED_SECRET') ?? '';
	if (secret.length < 32) return json({ error: 'NOT_CONFIGURED' }, 503);

	const ticket = String((await req.json().catch(() => ({})))?.ticket ?? '');
	const check = await verifyTicket(ticket, secret);
	// One answer for every kind of bad ticket: nothing to learn from the difference
	if (!check.ok) return json({ error: 'BAD_TICKET' }, 401);
	const t = check.payload;

	const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

	// One use only: the second time the same ticket id arrives, it is refused
	const used = await admin.from('sso_used_tickets').insert({ jti: t.jti });
	if (used.error) return json({ error: used.error.code === '23505' ? 'TICKET_USED' : 'SERVER_ERROR' }, used.error.code === '23505' ? 409 : 500);

	let email: string;
	if (t.role === 'team') {
		// A personal account on the test console, with the same team role as on the real one
		const { data, error } = await admin.rpc('sso_ensure_team_user', { p_email: t.sub, p_name: t.name, p_role: t.tr });
		if (error || typeof data !== 'string') return json({ error: 'SERVER_ERROR' }, 500);
		email = data;
	} else {
		email = FIXED_TEST_ACCOUNTS[t.role];
	}

	const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
	const tokenHash = link?.properties?.hashed_token;
	if (linkError || !tokenHash) return json({ error: 'SERVER_ERROR' }, 500);

	return json({ token_hash: tokenHash, next: t.role === 'team' ? '/admin/' : '/' });
});
