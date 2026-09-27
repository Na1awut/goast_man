import { describe as group, expect, it } from 'vitest';
import { createReporter, describe, isNoise, isStaleBuild, reloadForNewRelease, sourceOf, type ErrorReport } from './errorlog';

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

	it('knows a file from an older deploy when the tab outlived a release', () => {
		expect(isStaleBuild('TypeError: Failed to fetch dynamically imported module: https://goastman.dev/_app/immutable/nodes/1.BJ1pjjaQ.js')).toBe(true);
		expect(isStaleBuild('TypeError: Importing a module script failed.')).toBe(true);
		expect(isStaleBuild('TypeError: error loading dynamically imported module')).toBe(true);
		expect(isStaleBuild('TypeError: Failed to fetch')).toBe(false);
		expect(isStaleBuild('TypeError: x is undefined')).toBe(false);
	});

	it('reloads once for a new release, never in a loop', () => {
		const store = new Map<string, string>();
		const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
		let reloads = 0;
		const reload = () => reloads++;
		expect(reloadForNewRelease(storage, reload, 1_000_000)).toBe(true);
		// Still failing right after the reload: a real missing file, report it instead
		expect(reloadForNewRelease(storage, reload, 1_010_000)).toBe(false);
		// A later deploy may reload again
		expect(reloadForNewRelease(storage, reload, 1_100_000)).toBe(true);
		expect(reloads).toBe(2);
		// Storage blocked: no reload (it could not be stopped)
		expect(reloadForNewRelease(null, reload)).toBe(false);
		const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => {} };
		expect(reloadForNewRelease(throwing, reload)).toBe(false);
		expect(reloads).toBe(2);
	});
});
