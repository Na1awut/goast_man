// The console's order rules, mirrored from order_attention() / order_stage() in
// supabase/migrations/20261001000000_team_console.sql. Live mode uses the
// database's answer; demo mode and the tests use these.
import type { Attention, Payment, Stage } from './types';

export interface RuleOrder {
	status: Exclude<Stage, 'AWAITING_PAYMENT'>;
	payment: Payment;
	created_at: string;
	paid_at: string | null;
	refunded_at?: string | null;
	total: number;
	otp_failed?: number;
}

const MIN = 60_000;
const minutes = (from: string, now: number) => Math.floor((now - new Date(from).getTime()) / MIN);

export function stageOf(o: Pick<RuleOrder, 'status' | 'payment' | 'paid_at'>): Stage {
	return o.status === 'PENDING' && o.payment === 'PROMPTPAY' && !o.paid_at ? 'AWAITING_PAYMENT' : o.status;
}

/** Problems a person has to look at, most urgent first */
export function attentionOf(o: RuleOrder, now = Date.now()): Attention[] {
	const out: Attention[] = [];
	if (o.status === 'DELIVERING' && (o.otp_failed ?? 0) >= 5) out.push({ code: 'OTP_LOCKED', rank: 1 });
	if (o.status === 'CANCELLED' && o.paid_at && !o.refunded_at) out.push({ code: 'REFUND_DUE', rank: 2, amount: o.total });
	const age = minutes(o.created_at, now);
	if ((o.status === 'ACCEPTED' || o.status === 'DELIVERING') && age > 40) out.push({ code: 'LATE', rank: 3, minutes: age });
	if (o.status === 'PENDING' && (o.payment === 'CASH' || o.paid_at)) {
		const waiting = minutes(o.paid_at ?? o.created_at, now);
		if (waiting > 10) out.push({ code: 'UNASSIGNED', rank: 4, minutes: waiting });
	}
	if (o.status === 'PENDING' && o.payment === 'PROMPTPAY' && !o.paid_at && age > 15) out.push({ code: 'UNPAID', rank: 5, minutes: age });
	return out;
}

/**
 * What the team owes the rider for a finished job (mirrors rider_owed() in the
 * database). The rider paid the stall food_total less the store's own deal
 * (`store_discount`); `tip` is the round-up tip that is part of `total` (a tip
 * the buyer never paid in must be left out by the caller).
 */
export function owedToRider(o: { payment: Payment; food_total: number; delivery_fee: number; total: number; tip?: number; store_discount?: number }): number {
	return o.food_total - (o.store_discount ?? 0) + o.delivery_fee + (o.tip ?? 0) - (o.payment === 'CASH' ? o.total : 0);
}
