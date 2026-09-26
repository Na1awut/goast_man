import { describe, expect, it } from 'vitest';
import { promptPayAvailable } from './payments';

describe('promptPayAvailable', () => {
	it('always shows the mock in demo mode', () => {
		expect(promptPayAvailable(false, undefined)).toBe(true);
	});

	it('hides PromptPay in live mode until a payment API is configured', () => {
		expect(promptPayAvailable(true, undefined)).toBe(false);
		expect(promptPayAvailable(true, '   ')).toBe(false);
	});

	it('turns PromptPay on once the payment API URL is set', () => {
		expect(promptPayAvailable(true, 'https://pay.example.com')).toBe(true);
	});
});
