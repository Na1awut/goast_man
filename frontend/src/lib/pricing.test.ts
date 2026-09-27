import { describe, expect, it } from 'vitest';
import { roundUpTip } from './pricing';

describe('round-up tip', () => {
	it('rounds to the next 5 baht', () => {
		expect(roundUpTip(52)).toBe(3);
		expect(roundUpTip(58)).toBe(2);
		expect(roundUpTip(61)).toBe(4);
	});
	it('offers nothing when the total already ends in 0 or 5', () => {
		expect(roundUpTip(55)).toBe(0);
		expect(roundUpTip(60)).toBe(0);
		expect(roundUpTip(0)).toBe(0);
	});
});
