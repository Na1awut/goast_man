import { describe, expect, it } from 'vitest';
import { awaitingPayment, promptPayAvailable, promptPayPayload } from './payments';

describe('promptPayAvailable', () => {
	it('always shows the mock in demo mode', () => {
		expect(promptPayAvailable(false, undefined, undefined)).toBe(true);
	});

	it('hides PromptPay in live mode until both the slip API and the PromptPay number are set', () => {
		expect(promptPayAvailable(true, undefined, undefined)).toBe(false);
		expect(promptPayAvailable(true, '   ', '0812345678')).toBe(false);
		expect(promptPayAvailable(true, 'https://x.supabase.co/functions/v1/verify-slip', '')).toBe(false);
	});

	it('turns PromptPay on once both are set', () => {
		expect(promptPayAvailable(true, 'https://x.supabase.co/functions/v1/verify-slip', '0812345678')).toBe(true);
	});
});

describe('promptPayPayload', () => {
	/** Splits the EMVCo text into its tag → value fields */
	const fields = (payload: string) => {
		const out: Record<string, string> = {};
		for (let i = 0; i < payload.length; ) {
			const len = Number(payload.slice(i + 2, i + 4));
			out[payload.slice(i, i + 2)] = payload.slice(i + 4, i + 4 + len);
			i += 4 + len;
		}
		return out;
	};

	it('encodes a one-time THB payment of the order total to the PromptPay number', () => {
		const f = fields(promptPayPayload(55, '0812345678'));
		expect(f['01']).toBe('12');
		expect(f['29']).toContain('A000000677010111');
		expect(f['29']).toContain('0066812345678');
		expect(f['53']).toBe('764');
		expect(f['54']).toBe('55.00');
		expect(f['58']).toBe('TH');
		expect(f['63']).toMatch(/^[0-9A-F]{4}$/);
	});
});

describe('awaitingPayment', () => {
	it('is true only for an open PromptPay order without a verified slip', () => {
		expect(awaitingPayment({ paymentMethod: 'PROMPTPAY', paidAt: undefined, status: 'PENDING' })).toBe(true);
		expect(awaitingPayment({ paymentMethod: 'PROMPTPAY', paidAt: '2026-09-27T12:00:00Z', status: 'PENDING' })).toBe(false);
		expect(awaitingPayment({ paymentMethod: 'CASH', paidAt: undefined, status: 'PENDING' })).toBe(false);
		expect(awaitingPayment({ paymentMethod: 'PROMPTPAY', paidAt: undefined, status: 'CANCELLED' })).toBe(false);
	});
});
