// The verify-slip Edge Function's decision logic, with a fake SlipOK and database
import { describe, expect, it, vi } from 'vitest';
import { verifySlip, type PayableOrder, type SlipCheckDeps, type SlipOkResponse } from '../../../supabase/functions/verify-slip/core.ts';

const BUYER = 'buyer-1';
const order = (extra: Partial<PayableOrder> = {}): PayableOrder => ({
	id: 'order-1',
	customer_id: BUYER,
	payment_method: 'PROMPTPAY',
	status: 'PENDING',
	paid_at: null,
	total_price: 55,
	...extra
});
const slipOk = (extra: Partial<SlipOkResponse> = {}): SlipOkResponse => ({
	success: true,
	data: { success: true, transRef: 'TXN-001', amount: 55 },
	...extra
});

function deps(o: PayableOrder | null, res: SlipOkResponse | Error, recordError?: string, recorded?: 'PAID' | 'REFUND_DUE') {
	const d = {
		getOrder: vi.fn(async () => o),
		checkSlip: vi.fn(async () => {
			if (res instanceof Error) throw res;
			return res;
		}),
		recordPayment: vi.fn(async () => {
			if (recordError) throw new Error(recordError);
			return recorded;
		})
	} satisfies SlipCheckDeps;
	return d;
}

describe('verifySlip', () => {
	it('records a valid slip for the full order total', async () => {
		const d = deps(order(), slipOk());
		expect(await verifySlip(BUYER, 'order-1', d)).toEqual({ ok: true, ref: 'TXN-001' });
		expect(d.checkSlip).toHaveBeenCalledWith(55);
		expect(d.recordPayment).toHaveBeenCalledWith('order-1', 'TXN-001', 55);
	});

	it("refuses someone else's order without calling SlipOK", async () => {
		const d = deps(order({ customer_id: 'someone-else' }), slipOk());
		expect(await verifySlip(BUYER, 'order-1', d)).toMatchObject({ ok: false, code: 'ORDER_NOT_FOUND' });
		expect(d.checkSlip).not.toHaveBeenCalled();
	});

	it('refuses cash and cancelled orders', async () => {
		expect(await verifySlip(BUYER, 'order-1', deps(order({ payment_method: 'CASH' }), slipOk()))).toMatchObject({ code: 'ORDER_NOT_PAYABLE' });
		expect(await verifySlip(BUYER, 'order-1', deps(order({ status: 'CANCELLED' }), slipOk()))).toMatchObject({ code: 'ORDER_NOT_PAYABLE' });
	});

	it('does not spend another SlipOK check on an order already paid', async () => {
		const d = deps(order({ paid_at: '2026-09-27T12:00:00Z' }), slipOk());
		expect(await verifySlip(BUYER, 'order-1', d)).toEqual({ ok: true, alreadyPaid: true });
		expect(d.checkSlip).not.toHaveBeenCalled();
	});

	it("maps SlipOK's reused-slip, wrong-amount and wrong-receiver errors", async () => {
		const failWith = (code: number) => deps(order(), { success: false, code, message: 'x' });
		expect(await verifySlip(BUYER, 'order-1', failWith(1012))).toMatchObject({ code: 'SLIP_USED' });
		expect(await verifySlip(BUYER, 'order-1', failWith(1013))).toMatchObject({ code: 'SLIP_AMOUNT_MISMATCH' });
		expect(await verifySlip(BUYER, 'order-1', failWith(1014))).toMatchObject({ code: 'SLIP_WRONG_RECEIVER' });
		expect(await verifySlip(BUYER, 'order-1', failWith(1006))).toMatchObject({ code: 'SLIP_INVALID' });
	});

	it('double-checks the amount even when SlipOK says success', async () => {
		const d = deps(order(), slipOk({ data: { success: true, transRef: 'TXN-1', amount: 50 } }));
		expect(await verifySlip(BUYER, 'order-1', d)).toMatchObject({ code: 'SLIP_AMOUNT_MISMATCH' });
		expect(d.recordPayment).not.toHaveBeenCalled();
	});

	it('reports SlipOK being down separately from a bad slip', async () => {
		expect(await verifySlip(BUYER, 'order-1', deps(order(), new Error('network')))).toMatchObject({ code: 'SLIPOK_UNAVAILABLE', status: 502 });
	});

	it('passes on the database refusing a slip already used for another order', async () => {
		const d = deps(order(), slipOk(), 'SLIP_USED');
		expect(await verifySlip(BUYER, 'order-1', d)).toMatchObject({ ok: false, code: 'SLIP_USED' });
	});

	it('a cancelled order is refused at first, but checked and booked as a refund when the slip was already queued', async () => {
		const cancelled = order({ status: 'CANCELLED' });
		expect(await verifySlip(BUYER, 'order-1', deps(cancelled, slipOk()))).toMatchObject({ ok: false, code: 'ORDER_NOT_PAYABLE' });
		const d = deps(cancelled, slipOk(), undefined, 'REFUND_DUE');
		expect(await verifySlip(BUYER, 'order-1', d, { allowCancelled: true })).toEqual({ ok: true, ref: 'TXN-001', refundDue: true });
		expect(d.recordPayment).toHaveBeenCalledWith('order-1', 'TXN-001', 55);
	});

	it('keeps the SlipOK reference when the slip was accepted but the payment could not be recorded', async () => {
		const unknown = await verifySlip(BUYER, 'order-1', deps(order(), slipOk(), 'connection reset'));
		expect(unknown).toMatchObject({ ok: false, code: 'PAYMENT_NOT_RECORDED', verifiedRef: 'TXN-001' });
		const known = await verifySlip(BUYER, 'order-1', deps(order(), slipOk(), 'ORDER_NOT_PAYABLE'));
		expect(known).toMatchObject({ ok: false, code: 'ORDER_NOT_PAYABLE', verifiedRef: 'TXN-001' });
	});

	it('a slip rejected by SlipOK has no verified reference (nothing to settle)', async () => {
		const r = await verifySlip(BUYER, 'order-1', deps(order(), { success: false, code: 1012 }));
		expect(r).toMatchObject({ ok: false, code: 'SLIP_USED' });
		expect(r).not.toHaveProperty('verifiedRef');
	});

	it('treats a payment that landed in the meantime as paid, not as a failure', async () => {
		expect(await verifySlip(BUYER, 'order-1', deps(order(), slipOk(), 'ALREADY_PAID'))).toEqual({ ok: true, alreadyPaid: true, ref: 'TXN-001' });
	});
});
