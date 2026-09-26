import { describe, expect, it } from 'vitest';
import { attentionOf, owedToRider, stageOf, type RuleOrder } from './rules';
import { allowsAdminPath, isConsoleHost } from './host';
import { ago, baht, phone } from './format';

const NOW = Date.parse('2026-09-26T05:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const order = (o: Partial<RuleOrder>): RuleOrder => ({ status: 'PENDING', payment: 'CASH', created_at: minutesAgo(1), paid_at: null, total: 90, ...o });
const codes = (o: RuleOrder) => attentionOf(o, NOW).map((a) => a.code);

describe('order rules (same as the database)', () => {
	it('splits unpaid PromptPay from waiting for a rider', () => {
		expect(stageOf(order({ payment: 'PROMPTPAY' }))).toBe('AWAITING_PAYMENT');
		expect(stageOf(order({ payment: 'PROMPTPAY', paid_at: minutesAgo(1) }))).toBe('PENDING');
		expect(stageOf(order({}))).toBe('PENDING');
	});

	it('flags a paid or cash order with no rider after 10 minutes, counted from payment', () => {
		expect(codes(order({ created_at: minutesAgo(9) }))).toEqual([]);
		expect(attentionOf(order({ created_at: minutesAgo(12) }), NOW)).toEqual([{ code: 'UNASSIGNED', rank: 4, minutes: 12 }]);
		expect(codes(order({ payment: 'PROMPTPAY', created_at: minutesAgo(30), paid_at: minutesAgo(5) }))).toEqual([]);
	});

	it('flags unpaid PromptPay after 15 minutes', () => {
		expect(codes(order({ payment: 'PROMPTPAY', created_at: minutesAgo(14) }))).toEqual([]);
		expect(codes(order({ payment: 'PROMPTPAY', created_at: minutesAgo(16) }))).toEqual(['UNPAID']);
	});

	it('flags late jobs, locked OTPs and refunds, most urgent first', () => {
		expect(codes(order({ status: 'DELIVERING', created_at: minutesAgo(45), otp_failed: 5 }))).toEqual(['OTP_LOCKED', 'LATE']);
		expect(codes(order({ status: 'CANCELLED', payment: 'PROMPTPAY', paid_at: minutesAgo(20) }))).toEqual(['REFUND_DUE']);
		expect(codes(order({ status: 'CANCELLED', payment: 'PROMPTPAY', paid_at: minutesAgo(20), refunded_at: minutesAgo(1) }))).toEqual([]);
		expect(codes(order({ status: 'COMPLETED', created_at: minutesAgo(90) }))).toEqual([]);
	});

	it('owes PromptPay riders food + fee, cash riders only the discount', () => {
		expect(owedToRider({ payment: 'PROMPTPAY', food_total: 75, delivery_fee: 15, total: 90 })).toBe(90);
		expect(owedToRider({ payment: 'CASH', food_total: 40, delivery_fee: 15, total: 40 })).toBe(15);
	});
});

describe('console hosts', () => {
	it('opens at the root of goastman.dev only', () => {
		expect(isConsoleHost('goastman.dev')).toBe(true);
		expect(isConsoleHost('WWW.goastman.dev')).toBe(true);
		expect(isConsoleHost('goose-man.tech')).toBe(false);
	});

	it('never opens /admin on the public buyer site', () => {
		expect(allowsAdminPath('goose-man.tech')).toBe(false);
		expect(allowsAdminPath('www.goose-man.tech')).toBe(false);
		expect(allowsAdminPath('localhost')).toBe(true);
		expect(allowsAdminPath('goast-man-otu3.vercel.app')).toBe(true);
	});
});

describe('console formatting', () => {
	it('formats baht, phones and time ago', () => {
		expect(baht(18420)).toBe('฿18,420');
		expect(phone('0812345678')).toBe('081-234-5678');
		expect(ago(minutesAgo(6), NOW)).toBe('6 นาทีที่แล้ว');
		expect(ago(minutesAgo(75), NOW)).toBe('1 ชม. 15 นาทีที่แล้ว');
	});
});
