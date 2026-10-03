// test-ticket (REAL project): lets a signed-in member of the Goose Man team (ADMIN or STAFF)
// open the test site without a separate password. It checks the caller against the real
// database (team_me), then hands back a 60-second signed ticket for the role they ask for.
// The test site's test-login checks the ticket; see _shared/ticket.ts.
//
// POST { role } with the caller's Authorization: Bearer <access token>.
// Returns { ticket, url } or { error: CODE }.
//
// Secrets (Supabase -> Edge Functions -> Secrets), never in the app:
//   SSO_SHARED_SECRET  the same value as on the test project (32+ chars)
//   TEST_SITE_URL      https://... of the test site, no trailing slash
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { newJti, signTicket, TEST_ROLES, TICKET_AUDIENCE, TICKET_ISSUER, TICKET_TTL_SECONDS, type TestRole } from '../_shared/ticket.ts';

const cors = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
	if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

	const secret = Deno.env.get('SSO_SHARED_SECRET') ?? '';
	const siteUrl = (Deno.env.get('TEST_SITE_URL') ?? '').replace(/\/+$/, '');
	if (secret.length < 32 || !/^https:\/\/[^/\s]+$/.test(siteUrl)) return json({ error: 'NOT_CONFIGURED' }, 503);

	const role = String((await req.json().catch(() => ({})))?.role ?? '') as TestRole;
	if (!(TEST_ROLES as readonly string[]).includes(role)) return json({ error: 'BAD_ROLE' }, 400);

	// Who is asking, and are they on the team? The database says so, not the caller.
	const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
		global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
		auth: { persistSession: false }
	});
	const { data: me, error } = await user.rpc('team_me');
	if (error) return json({ error: 'AUTH_REQUIRED' }, 401);
	if (!me || (me.role !== 'ADMIN' && me.role !== 'STAFF') || typeof me.email !== 'string') return json({ error: 'TEAM_ONLY' }, 403);

	const ticket = await signTicket(
		{
			iss: TICKET_ISSUER,
			aud: TICKET_AUDIENCE,
			sub: me.email.toLowerCase(),
			name: String(me.nickname || me.full_name || me.email).slice(0, 60),
			tr: me.role,
			role,
			exp: Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS,
			jti: newJti()
		},
		secret
	);
	// The ticket travels in the URL fragment: it is not sent to any server or written to a log
	return json({ ticket, url: `${siteUrl}/enter/` });
});
