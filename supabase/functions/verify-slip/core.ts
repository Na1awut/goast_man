// Slip check for one PromptPay order, free of Deno and network code so it can
// be unit-tested with a fake SlipOK (frontend/src/lib/verifySlip.test.ts).
// index.ts wires it to Supabase and the real SlipOK API.

export interface PayableOrder {
	id: string;
	customer_id: string;
	payment_method: string;
	status: string;
	paid_at: string | null;
	total_price: number;
}

/** The parts of SlipOK's response this check reads (api.slipok.com/api/line/apikey/<branch>) */
export interface SlipOkResponse {
	success?: boolean;
	code?: number;
	message?: string;
	data?: { success?: boolean; transRef?: string; amount?: number | string };
}

export interface SlipCheckDeps {
	getOrder(id: string): Promise<PayableOrder | null>;
	/** Sends the slip image with amount and log=true, so SlipOK also checks the receiving account and duplicates */
	checkSlip(amount: number): Promise<SlipOkResponse>;
	/** record_slip_payment(); throws with the database error code in the message. 'REFUND_DUE': the order was cancelled meanwhile, the money is booked for refund */
	recordPayment(orderId: string, slipRef: string, amount: number): Promise<'PAID' | 'REFUND_DUE' | void>;
}

/**
 * ok: the payment is recorded (ref = SlipOK's transaction reference).
 * verifiedRef on a failure: SlipOK accepted the slip but it could not be recorded, so a person must look at it: never drop it.
 */
export type VerifyResult =
	| { ok: true; alreadyPaid?: boolean; refundDue?: boolean; ref?: string }
	| { ok: false; code: string; status: number; verifiedRef?: string };

/** SlipOK error codes that mean something to the buyer; anything else is an unreadable or invalid slip */
const SLIPOK_CODES: Record<number, string> = {
	1012: 'SLIP_USED',
	1013: 'SLIP_AMOUNT_MISMATCH',
	1014: 'SLIP_WRONG_RECEIVER'
};

const DB_CODES = ['SLIP_USED', 'ALREADY_PAID', 'SLIP_AMOUNT_MISMATCH', 'ORDER_NOT_PAYABLE', 'SLIP_INVALID'];

const fail = (code: string, status: number, verifiedRef?: string): VerifyResult => ({ ok: false, code, status, ...(verifiedRef ? { verifiedRef } : {}) });

/** allowCancelled: the buyer may have cancelled while the slip waited in the queue; the money still arrived, so check and record it (it becomes a refund) */
export async function verifySlip(userId: string, orderId: string, deps: SlipCheckDeps, opts: { allowCancelled?: boolean } = {}): Promise<VerifyResult> {
	const order = await deps.getOrder(orderId);
	if (!order || order.customer_id !== userId) return fail('ORDER_NOT_FOUND', 404);
	if (order.payment_method !== 'PROMPTPAY' || (order.status === 'CANCELLED' && !opts.allowCancelled)) return fail('ORDER_NOT_PAYABLE', 409);
	// A retry after a dropped response must not spend another SlipOK check
	if (order.paid_at) return { ok: true, alreadyPaid: true };

	let res: SlipOkResponse;
	try {
		res = await deps.checkSlip(order.total_price);
	} catch {
		return fail('SLIPOK_UNAVAILABLE', 502);
	}
	if (!res?.success || !res.data?.success) return fail(SLIPOK_CODES[res?.code ?? 0] ?? 'SLIP_INVALID', 422);
	// SlipOK compared the amount already; check again rather than trust one field
	if (Number(res.data.amount) !== order.total_price) return fail('SLIP_AMOUNT_MISMATCH', 422);
	const ref = res.data.transRef?.trim();
	if (!ref) return fail('SLIP_INVALID', 422);

	try {
		const recorded = await deps.recordPayment(order.id, ref, order.total_price);
		return { ok: true, ref, ...(recorded === 'REFUND_DUE' ? { refundDue: true } : {}) };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const code = DB_CODES.find((c) => message.includes(c));
		if (code === 'ALREADY_PAID') return { ok: true, alreadyPaid: true, ref };
		// Whatever the reason, SlipOK accepted this transfer: keep the reference so the team can settle it
		return fail(code ?? 'PAYMENT_NOT_RECORDED', 409, ref);
	}
}
