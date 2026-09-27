import { describe as group, expect, it } from 'vitest';
import { createReporter, describe, isNoise, sourceOf, type ErrorReport } from './errorlog';

const base: ErrorReport = { app: 'buyer', kind: 'error', message: 'TypeError: x is undefined', stack: '', source: 'https://goose-man.tech/_app/a.js:1:2', url: 'https://goose-man.tech/' };

group('error log', () => {
	it('skips noise that is not ours or not actionable', () => {
		expect(isNoise('ResizeObserver loop completed with undelivered notifications.', '')).toBe(true);
		expect(isNoise('Script error.', '')).toBe(true);
		expect(isNoise('TypeError: Failed to fetch', '')).toBe(true);
		expect(isNoise('boom', 'chrome-extension://abc/content.js:1:1')).toBe(true);
		expect(isNoise('TypeError: x is undefined', base.source)).toBe(false);
		// A stale chunk after a deploy is worth knowing about
		expect(isNoise('TypeError: Failed to fetch dynamically imported module: https://goose-man.tech/_app/x.js', '')).toBe(false);
	});

	it('describes anything thrown', () => {
		const err = new RangeError('bad');
		expect(describe(err).message).toBe('RangeError: bad');
		expect(describe('plain').message).toBe('plain');
		expect(describe({ code: 42 }).message).toBe('{"code":42}');
	});

	it('finds the first file:line:col in a stack', () => {
		expect(sourceOf('Error: x\n    at f (https://goose-man.tech/_app/a.js:10:5)\n    at g (https://goose-man.tech/_app/b.js:1:1)')).toBe('https://goose-man.tech/_app/a.js:10:5');
		expect(sourceOf('f@https://goose-man.tech/_app/a.js:3:7')).toBe('https://goose-man.tech/_app/a.js:3:7');
		expect(sourceOf('')).toBe('');
	});

	it('sends each error once per quiet period and stops at the cap', () => {
		let t = 0;
		const sent: ErrorReport[] = [];
		const report = createReporter((r) => sent.push(r), { quietMs: 1000, max: 3, now: () => t });
		expect(report(base)).toBe(true);
		expect(report(base)).toBe(false);
		t = 1500;
		expect(report(base)).toBe(true);
		expect(report({ ...base, source: 'other.js:1:1' })).toBe(true);
		expect(report({ ...base, message: 'another' })).toBe(false);
		expect(sent).toHaveLength(3);
	});

	it('never sends noise or empty messages', () => {
		const sent: ErrorReport[] = [];
		const report = createReporter((r) => sent.push(r));
		report({ ...base, message: '' });
		report({ ...base, message: 'Script error.' });
		expect(sent).toHaveLength(0);
	});
});
