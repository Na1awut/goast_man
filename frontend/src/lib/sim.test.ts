import { describe, expect, it } from 'vitest';
import { simulationFlag } from './sim';

describe('test-site flag', () => {
	it('is on only for the word "true"', () => {
		expect(simulationFlag('true')).toBe(true);
		expect(simulationFlag(' TRUE ')).toBe(true);
		for (const off of [undefined, null, '', 'false', '1', 'yes', 'on']) expect(simulationFlag(off)).toBe(false);
	});
});
