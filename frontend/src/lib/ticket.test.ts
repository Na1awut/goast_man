import { describe, expect, it } from 'vitest';
import {
	FIXED_TEST_ACCOUNTS,
	newJti,
	signTicket,
	TEST_ROLES,
	TICKET_AUDIENCE,
	TICKET_ISSUER,
	TICKET_TTL_SECONDS,
	verifyTicket,
	type TicketPayload
} from '../../../supabase/functions/_shared/ticket';

const SECRET = 'a'.repeat(40) + 'S3cret-for-tests-only';
const NOW = 1_800_000_000;

const payload = (over: Partial<TicketPayload> = {}): TicketPayload => ({
	iss: TICKET_ISSUER,
	aud: TICKET_AUDIENCE,
	sub: 'someone@mail.kmutt.ac.th',
	name: 'Someone',
	tr: 'ADMIN',
	role: 'team',
	exp: NOW + TICKET_TTL_SECONDS,
	jti: newJti(),
	...over
});

describe('test-site entry ticket', () => {
	it('a fresh ticket checks out and carries who and which role', async () => {
		const t = await signTicket(payload({ role: 'rider1' }), SECRET);
		const r = await verifyTicket(t, SECRET, NOW);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.payload.sub).toBe('someone@mail.kmutt.ac.th');
			expect(r.payload.role).toBe('rider1');
		}
	});

	it('a different secret refuses it', async () => {
		const t = await signTicket(payload(), SECRET);
		expect(await verifyTicket(t, 'b'.repeat(40), NOW)).toEqual({ ok: false, reason: 'BAD_SIGNATURE' });
	});

	it('changing anything in the payload (e.g. asking for another role or person) breaks the signature', async () => {
		const t = await signTicket(payload({ role: 'student1' }), SECRET);
		const [body, sig] = t.split('.');
		const forged = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
		forged.sub = 'attacker@example.com';
		forged.role = 'team';
		const text = btoa(JSON.stringify(forged)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		expect(await verifyTicket(`${text}.${sig}`, SECRET, NOW)).toEqual({ ok: false, reason: 'BAD_SIGNATURE' });
	});

	it('expires after 60 seconds', async () => {
		const t = await signTicket(payload(), SECRET);
		expect((await verifyTicket(t, SECRET, NOW + TICKET_TTL_SECONDS - 1)).ok).toBe(true);
		expect(await verifyTicket(t, SECRET, NOW + TICKET_TTL_SECONDS + 1)).toEqual({ ok: false, reason: 'EXPIRED' });
	});

	it('refuses a ticket meant to live longer than the limit, even if signed', async () => {
		const t = await signTicket(payload({ exp: NOW + 3600 }), SECRET);
		expect(await verifyTicket(t, SECRET, NOW)).toEqual({ ok: false, reason: 'EXPIRED' });
	});

	it('refuses another audience or issuer (a ticket from some other system that shares the secret)', async () => {
		expect(await verifyTicket(await signTicket(payload({ aud: 'something-else' }), SECRET), SECRET, NOW)).toEqual({ ok: false, reason: 'WRONG_AUDIENCE' });
		expect(await verifyTicket(await signTicket(payload({ iss: 'someone-else' }), SECRET), SECRET, NOW)).toEqual({ ok: false, reason: 'WRONG_AUDIENCE' });
	});

	it('refuses roles and team roles that do not exist (no "owner", no "SUPERADMIN")', async () => {
		expect(await verifyTicket(await signTicket(payload({ role: 'admin1' as never }), SECRET), SECRET, NOW)).toEqual({ ok: false, reason: 'BAD_ROLE' });
		expect(await verifyTicket(await signTicket(payload({ tr: 'OWNER' as never }), SECRET), SECRET, NOW)).toEqual({ ok: false, reason: 'BAD_ROLE' });
	});

	it('refuses garbage without throwing', async () => {
		for (const bad of ['', 'abc', 'a.b.c', '.', 'a.', '.b', '%%%.%%%', 'x'.repeat(3000)]) {
			const r = await verifyTicket(bad, SECRET, NOW);
			expect(r.ok).toBe(false);
		}
		expect((await verifyTicket('a.b', '', NOW)).ok).toBe(false);
	});

	it('will not sign with a weak secret', async () => {
		await expect(signTicket(payload(), 'short')).rejects.toThrow('SECRET_TOO_SHORT');
	});

	it('every ticket gets its own id, and each shared role maps to a test account', () => {
		expect(newJti()).not.toBe(newJti());
		for (const role of TEST_ROLES) if (role !== 'team') expect(FIXED_TEST_ACCOUNTS[role]).toMatch(/@/);
		expect(Object.keys(FIXED_TEST_ACCOUNTS)).toHaveLength(TEST_ROLES.length - 1);
	});
});
