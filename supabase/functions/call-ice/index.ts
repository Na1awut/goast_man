// call-ice: the ICE servers for one in-app call.
//
// POST { order_id } with the caller's Authorization: Bearer <access token>.
// Only someone who may call on that order right now (can_call) gets servers.
// Returns { iceServers: RTCIceServer[] }.
//
// With Cloudflare TURN set up, returns short-lived TURN credentials, so calls
// connect on any network (campus Wi-Fi, 4G/5G). Without it, STUN only: calls
// between phones behind strict NATs may not connect.
//
// Secrets (Supabase → Edge Functions → Secrets), never in the app:
//   CF_TURN_KEY_ID, CF_TURN_API_TOKEN   (Cloudflare dashboard → Realtime → TURN)
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const STUN = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
/** A call rarely lasts longer; the credentials die with it */
const TTL_SECONDS = 2 * 60 * 60;

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
	if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

	const orderId = String((await req.json().catch(() => ({})))?.order_id ?? '');
	if (!/^[0-9a-f-]{36}$/.test(orderId)) return json({ error: 'BAD_REQUEST' }, 400);

	const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
		global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
		auth: { persistSession: false }
	});
	const { data: allowed, error } = await user.rpc('can_call', { p_order_id: orderId });
	if (error) return json({ error: 'AUTH_REQUIRED' }, 401);
	if (!allowed) return json({ error: 'CALL_NOT_ALLOWED' }, 403);

	const keyId = Deno.env.get('CF_TURN_KEY_ID');
	const token = Deno.env.get('CF_TURN_API_TOKEN');
	if (!keyId || !token) return json({ iceServers: STUN, turn: false });

	try {
		const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ ttl: TTL_SECONDS })
		});
		if (!res.ok) throw new Error(String(res.status));
		const body = await res.json();
		const servers = Array.isArray(body.iceServers) ? body.iceServers : [body.iceServers];
		return json({ iceServers: [...STUN, ...servers], turn: true });
	} catch {
		// TURN is down: STUN still connects many calls
		return json({ iceServers: STUN, turn: false });
	}
});
