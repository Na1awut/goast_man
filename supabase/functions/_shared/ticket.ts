// Entry ticket for the test site. A signed-in team member of the REAL project asks
// test-ticket for one; the test site's test-login checks it and lets them in as a
// test account. The two projects share one secret (SSO_SHARED_SECRET) and nothing else.
//
// A ticket is "<payload>.<signature>", both base64url: the payload is JSON, the
// signature is HMAC-SHA256 of the payload text. It lives 60 seconds, is for one use
// (the test side remembers its jti) and names the test role the person asked for.
// Plain Web Crypto, so it runs in Deno (Edge Functions) and Node (the unit tests).

export const TICKET_TTL_SECONDS = 60;
export const TICKET_ISSUER = 'goose-man-real';
export const TICKET_AUDIENCE = 'goose-man-test';

/** What the person may ask to be on the test site */
export const TEST_ROLES = ['student1', 'student2', 'rider1', 'rider2', 'shop1', 'shop2', 'team'] as const;
export type TestRole = (typeof TEST_ROLES)[number];

export interface TicketPayload {
	iss: string;
	aud: string;
	/** Who: the real team member's email */
	sub: string;
	name: string;
	/** Their team role on the real site (ADMIN or STAFF), given to them on the test console */
	tr: 'ADMIN' | 'STAFF';
	role: TestRole;
	exp: number;
	jti: string;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(text: string): Uint8Array {
	const pad = '='.repeat((4 - (text.length % 4)) % 4);
	const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad);
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export function newJti(): string {
	return b64url(crypto.getRandomValues(new Uint8Array(16)));
}

export async function signTicket(payload: TicketPayload, secret: string): Promise<string> {
	if (secret.length < 32) throw new Error('SECRET_TOO_SHORT');
	const body = b64url(enc.encode(JSON.stringify(payload)));
	const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), enc.encode(body)));
	return `${body}.${b64url(sig)}`;
}

export type TicketCheck = { ok: true; payload: TicketPayload } | { ok: false; reason: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' | 'WRONG_AUDIENCE' | 'BAD_ROLE' };

/** Checks signature (constant time, by the crypto library), then expiry, audience and the asked-for role */
export async function verifyTicket(ticket: string, secret: string, now = Math.floor(Date.now() / 1000)): Promise<TicketCheck> {
	if (secret.length < 32 || typeof ticket !== 'string' || ticket.length > 2000) return { ok: false, reason: 'MALFORMED' };
	const parts = ticket.split('.');
	if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'MALFORMED' };
	let payload: TicketPayload;
	try {
		const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), fromB64url(parts[1]) as BufferSource, enc.encode(parts[0]));
		if (!valid) return { ok: false, reason: 'BAD_SIGNATURE' };
		payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[0])));
	} catch {
		return { ok: false, reason: 'MALFORMED' };
	}
	if (payload.iss !== TICKET_ISSUER || payload.aud !== TICKET_AUDIENCE) return { ok: false, reason: 'WRONG_AUDIENCE' };
	if (!Number.isFinite(payload.exp) || payload.exp <= now || payload.exp > now + TICKET_TTL_SECONDS + 5) return { ok: false, reason: 'EXPIRED' };
	if (!(TEST_ROLES as readonly string[]).includes(payload.role) || !['ADMIN', 'STAFF'].includes(payload.tr)) return { ok: false, reason: 'BAD_ROLE' };
	if (typeof payload.sub !== 'string' || !payload.sub.includes('@') || typeof payload.jti !== 'string' || payload.jti.length < 10) return { ok: false, reason: 'MALFORMED' };
	return { ok: true, payload };
}

/** The shared test accounts a role maps to (the team role gets a personal account instead) */
export const FIXED_TEST_ACCOUNTS: Record<Exclude<TestRole, 'team'>, string> = {
	student1: 'buyer1@mail.kmutt.ac.th',
	student2: 'buyer2@mail.kmutt.ac.th',
	rider1: 'rider1@mail.kmutt.ac.th',
	rider2: 'rider2@mail.kmutt.ac.th',
	shop1: 'shop1@example.com',
	shop2: 'shop2@example.com'
};
