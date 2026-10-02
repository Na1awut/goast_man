import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decide, ownerFollowSchedule, ownerSetOpen, refreshAll, saveHours, statusOf, teamRelease, teamSetOpen } from './storeOpenDemo';
import type { OperatingHours, Store } from './types';

// The demo's open/closed rules must behave like the database's (supabase/migrations/20261031...,
// tested in tests/sql.mjs): same precedence, same expiry, same refusals.

const DAY: OperatingHours = { enabled: true, openTime: '08:00', closeTime: '17:00' };
let n = 0;
const makeStore = (over: Partial<Store> = {}): Store => ({ id: `s${++n}`, isOpen: true, hidden: false, ...over }) as Store;
/** Friday 2026-10-02, Bangkok time */
const at = (hhmm: string) => new Date(`2026-10-02T${hhmm}:00+07:00`);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('store open rules (demo)', () => {
	it('a store with no schedule is just the switch', () => {
		vi.setSystemTime(at('10:00'));
		const s = makeStore();
		expect(decide(s)).toBe(true);
		ownerSetOpen(s, false, 'ร้าน');
		expect(s.isOpen).toBe(false);
		expect(statusOf(s, false).source).toBe('OVERRIDE');
		ownerSetOpen(s, true, 'ร้าน');
		expect(s.isOpen).toBe(true);
	});

	it('the schedule opens and closes the store by itself, as the clock moves', () => {
		vi.setSystemTime(at('07:00'));
		const s = makeStore({ isOpen: false });
		saveHours(s, DAY, 'OWNER', 'ร้าน');
		expect(s.isOpen).toBe(false);
		expect(statusOf(s, false).source).toBe('SCHEDULE');
		vi.setSystemTime(at('08:00'));
		refreshAll([s]);
		expect(s.isOpen).toBe(true);
		vi.setSystemTime(at('17:00'));
		refreshAll([s]);
		expect(s.isOpen).toBe(false);
	});

	it('a team lock beats the owner and the schedule, and the owner is told why', () => {
		vi.setSystemTime(at('10:00'));
		const s = makeStore();
		saveHours(s, DAY, 'OWNER', 'ร้าน');
		const st = teamSetOpen(s, false, 'แซม', { reason: 'ติดต่อร้านไม่ได้' });
		expect(st.is_open).toBe(false);
		expect(st.source).toBe('TEAM_LOCK');
		expect(st.lock?.by).toBe('แซม');
		expect(() => ownerSetOpen(s, true, 'ร้าน')).toThrow('STORE_LOCKED');
		const ownerView = statusOf(s, false);
		expect(ownerView.lock?.reason).toBe('ติดต่อร้านไม่ได้');
		expect(ownerView.lock && 'by' in ownerView.lock).toBe(false);
		vi.setSystemTime(at('12:00')); // still inside the hours: still closed
		expect(decide(s)).toBe(false);
		expect(teamRelease(s, true).is_open).toBe(true);
	});

	it('a lock with an end time lets go by itself, and a store with no schedule comes back as it was', () => {
		vi.setSystemTime(at('10:00'));
		const s = makeStore(); // open, no schedule
		teamSetOpen(s, false, 'แซม', { reason: 'พัก', until: at('11:00').toISOString() });
		expect(s.isOpen).toBe(false);
		vi.setSystemTime(at('11:01'));
		expect(decide(s)).toBe(true);
	});

	it('a hand switch during the hours lasts until the schedule changes, then the schedule takes over', () => {
		vi.setSystemTime(at('10:00'));
		const s = makeStore();
		saveHours(s, DAY, 'OWNER', 'ร้าน');
		const closed = ownerSetOpen(s, false, 'ร้าน');
		expect(closed.override?.until).toBe(at('17:00').toISOString());
		vi.setSystemTime(at('16:59'));
		expect(decide(s)).toBe(false);
		vi.setSystemTime(new Date(at('08:30').getTime() + 86_400_000)); // tomorrow in the hours
		expect(decide(s)).toBe(true);
	});

	it('opening outside the hours lasts 4 hours by default, then closes', () => {
		vi.setSystemTime(at('19:00'));
		const s = makeStore();
		saveHours(s, DAY, 'OWNER', 'ร้าน');
		expect(s.isOpen).toBe(false);
		const st = ownerSetOpen(s, true, 'ร้าน');
		expect(st.override?.until).toBe(at('23:00').toISOString());
		vi.setSystemTime(at('22:59'));
		expect(decide(s)).toBe(true);
		vi.setSystemTime(at('23:01'));
		expect(decide(s)).toBe(false);
		expect(() => ownerSetOpen(s, true, 'ร้าน', 13)).toThrow('BAD_HOURS');
	});

	it('turning the schedule off keeps the store as it is', () => {
		vi.setSystemTime(at('10:00'));
		const s = makeStore();
		saveHours(s, DAY, 'OWNER', 'ร้าน');
		expect(s.isOpen).toBe(true);
		const st = saveHours(s, { ...DAY, enabled: false }, 'OWNER', 'ร้าน');
		expect(st.source).toBe('OVERRIDE');
		vi.setSystemTime(at('23:00'));
		expect(decide(s)).toBe(true);
	});

	it('a screen that is out of date is refused', () => {
		vi.setSystemTime(at('10:00'));
		const s = makeStore();
		const seen = statusOf(s, false).rev;
		teamSetOpen(s, true, 'แซม');
		expect(() => ownerSetOpen(s, false, 'ร้าน', undefined, seen)).toThrow('STORE_STATE_CHANGED');
	});

	it('refuses nonsense hours, hidden stores stay shut, and following needs a schedule', () => {
		vi.setSystemTime(at('10:00'));
		const s = makeStore();
		expect(() => saveHours(s, { enabled: true, openTime: '09:00', closeTime: '09:00' }, 'OWNER', 'ร้าน')).toThrow('BAD_HOURS');
		expect(() => saveHours(s, { ...DAY, days: [] }, 'OWNER', 'ร้าน')).toThrow('BAD_HOURS');
		expect(() => ownerFollowSchedule(s)).toThrow('NO_SCHEDULE');
		const h = makeStore({ hidden: true, isOpen: false });
		expect(decide(h)).toBe(false);
		expect(() => teamSetOpen(h, true, 'แซม')).toThrow('STORE_HIDDEN');
		expect(() => ownerSetOpen(h, true, 'ร้าน')).toThrow('STORE_PENDING_REVIEW');
	});
});
