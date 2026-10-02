// Demo mode's version of the database's store open/closed rules, so the demo
// behaves like the real thing (a team lock the owner can't undo, hand switches
// that end at the next schedule change, ...). It mirrors
// supabase/migrations/20261031000000_store_open_control.sql; the real app never
// uses this file. Everything lives in memory.
import { isWithinHours, nextScheduleChange } from '$lib/operatingHours';
import type { OperatingHours, Store, StoreOpenStatus } from '$lib/types';

interface Control {
	locked: boolean;
	lockReason: string;
	lockBy: string;
	lockAt: string | null;
	lockUntil: string | null;
	override: 'OPEN' | 'CLOSED' | null;
	overrideUntil: string | null;
	overrideBy: 'OWNER' | 'TEAM' | null;
	overrideByName: string;
	overrideAt: string | null;
	rev: number;
}

const controls = new Map<string, Control>();
const iso = (d: Date) => d.toISOString();
const live = (until: string | null, at: Date) => until === null || Date.parse(until) > at.getTime();
const scheduled = (h?: OperatingHours | null) => !!h?.enabled;

function blank(): Control {
	return { locked: false, lockReason: '', lockBy: '', lockAt: null, lockUntil: null, override: null, overrideUntil: null, overrideBy: null, overrideByName: '', overrideAt: null, rev: 0 };
}

function clearOverride(c: Control) {
	Object.assign(c, { override: null, overrideUntil: null, overrideBy: null, overrideByName: '', overrideAt: null });
}

/** Like the database migration: a store keeps exactly the state it has the first time it is touched */
function control(store: Store): Control {
	let c = controls.get(store.id);
	if (!c) {
		c = blank();
		const now = new Date();
		if (!scheduled(store.operatingHours)) {
			Object.assign(c, { override: store.isOpen ? 'OPEN' : 'CLOSED', overrideBy: 'OWNER' });
		} else if (store.isOpen !== isWithinHours(store.operatingHours, now)) {
			const next = nextScheduleChange(store.operatingHours, now);
			Object.assign(c, { override: store.isOpen ? 'OPEN' : 'CLOSED', overrideBy: 'OWNER', overrideUntil: next ? iso(next) : null });
		}
		controls.set(store.id, c);
	}
	return c;
}

/** The decision, in the order the database uses: hidden, team lock, hand switch, schedule, as is */
export function decide(store: Store, at = new Date()): boolean {
	if (store.hidden) return false;
	const c = control(store);
	if (c.locked && live(c.lockUntil, at)) return false;
	if (c.override && live(c.overrideUntil, at)) return c.override === 'OPEN';
	if (scheduled(store.operatingHours)) return isWithinHours(store.operatingHours, at);
	return store.isOpen;
}

/** The clock job: bring every store's open flag up to date */
export function refreshAll(stores: Store[], at = new Date()) {
	for (const s of stores) s.isOpen = decide(s, at);
}

export function statusOf(store: Store, forTeam: boolean, at = new Date()): StoreOpenStatus {
	const c = control(store);
	const sched = scheduled(store.operatingHours);
	const lock = c.locked && live(c.lockUntil, at);
	const ovr = !!c.override && live(c.overrideUntil, at);
	const next = sched ? nextScheduleChange(store.operatingHours, at) : null;
	return {
		is_open: decide(store, at),
		source: store.hidden ? 'HIDDEN' : lock ? 'TEAM_LOCK' : ovr ? 'OVERRIDE' : sched ? 'SCHEDULE' : 'MANUAL',
		schedule: store.operatingHours ?? null,
		schedule_open: sched ? isWithinHours(store.operatingHours, at) : null,
		next_change: next ? iso(next) : null,
		lock: lock ? { reason: c.lockReason, ...(forTeam ? { by: c.lockBy } : {}), at: c.lockAt, until: c.lockUntil } : null,
		override: ovr && c.override ? { value: c.override, by: c.overrideBy ?? 'OWNER', by_name: c.overrideByName, at: c.overrideAt, until: c.overrideUntil } : null,
		rev: c.rev,
		now: iso(at)
	};
}

function touch(store: Store, rev?: number | null): Control {
	const c = control(store);
	if (rev != null && c.rev !== rev) throw new Error('STORE_STATE_CHANGED');
	return c;
}

function finish(store: Store, c: Control, forTeam: boolean): StoreOpenStatus {
	c.rev++;
	store.isOpen = decide(store);
	return statusOf(store, forTeam);
}

/** Press open / closed: with a schedule it lasts until the schedule next changes (opening outside the hours: `extraHours`, default 4) */
function applyOverride(store: Store, c: Control, open: boolean, extraHours: number | null | undefined, by: 'OWNER' | 'TEAM', name: string, at = new Date()) {
	if (extraHours != null && (extraHours < 1 || extraHours > 12)) throw new Error('BAD_HOURS');
	let until: string | null = null;
	if (scheduled(store.operatingHours)) {
		const sched = isWithinHours(store.operatingHours, at);
		if (open === sched) return clearOverride(c);
		if (open) until = iso(new Date(at.getTime() + (extraHours ?? 4) * 3600_000));
		else {
			const next = nextScheduleChange(store.operatingHours, at);
			until = next ? iso(next) : null;
		}
	}
	Object.assign(c, { override: open ? 'OPEN' : 'CLOSED', overrideUntil: until, overrideBy: by, overrideByName: name, overrideAt: iso(at) });
}

// ---- Owner ----

export function ownerSetOpen(store: Store, open: boolean, name: string, extraHours?: number | null, rev?: number | null): StoreOpenStatus {
	const c = touch(store, rev);
	if (c.locked && live(c.lockUntil, new Date())) throw new Error('STORE_LOCKED');
	if (store.hidden && open) throw new Error('STORE_PENDING_REVIEW');
	applyOverride(store, c, open, extraHours, 'OWNER', name);
	return finish(store, c, false);
}

export function ownerFollowSchedule(store: Store, rev?: number | null): StoreOpenStatus {
	const c = touch(store, rev);
	if (!scheduled(store.operatingHours)) throw new Error('NO_SCHEDULE');
	clearOverride(c);
	return finish(store, c, false);
}

/** Turning the schedule on hands the store to the clock; turning it off freezes the state it is in */
export function saveHours(store: Store, hours: OperatingHours, by: 'OWNER' | 'TEAM', name: string, rev?: number | null): StoreOpenStatus {
	const c = touch(store, rev);
	if (hours.enabled && hours.openTime === hours.closeTime) throw new Error('BAD_HOURS');
	if (hours.enabled && hours.days && hours.days.length === 0) throw new Error('BAD_HOURS');
	const wasOn = scheduled(store.operatingHours);
	const openNow = decide(store);
	store.operatingHours = { ...hours, days: hours.days && hours.days.length < 7 ? [...hours.days].sort() : undefined };
	if (hours.enabled) clearOverride(c);
	else if (wasOn && !(c.locked && live(c.lockUntil, new Date()))) {
		Object.assign(c, { override: openNow ? 'OPEN' : 'CLOSED', overrideUntil: null, overrideBy: by, overrideByName: name, overrideAt: iso(new Date()) });
	}
	return finish(store, c, by === 'TEAM');
}

// ---- Team ----

/** Closing is a lock; opening clears it and opens the store */
export function teamSetOpen(store: Store, open: boolean, name: string, opts: { reason?: string; until?: string | null; extraHours?: number | null; rev?: number | null } = {}): StoreOpenStatus {
	const c = touch(store, opts.rev);
	const at = new Date();
	if (!open) {
		if (opts.until && Date.parse(opts.until) <= at.getTime()) throw new Error('BAD_UNTIL');
		if (!scheduled(store.operatingHours) && !(c.override && live(c.overrideUntil, at))) {
			Object.assign(c, { override: decide(store) ? 'OPEN' : 'CLOSED', overrideUntil: null, overrideBy: 'OWNER', overrideByName: '', overrideAt: iso(at) });
		}
		Object.assign(c, { locked: true, lockReason: (opts.reason ?? '').trim().slice(0, 200), lockBy: name, lockAt: iso(at), lockUntil: opts.until ?? null });
	} else {
		if (store.hidden) throw new Error('STORE_HIDDEN');
		Object.assign(c, { locked: false, lockReason: '', lockBy: '', lockAt: null, lockUntil: null });
		applyOverride(store, c, true, opts.extraHours, 'TEAM', name, at);
	}
	return finish(store, c, true);
}

export function teamRelease(store: Store, followSchedule: boolean, rev?: number | null): StoreOpenStatus {
	const c = touch(store, rev);
	Object.assign(c, { locked: false, lockReason: '', lockBy: '', lockAt: null, lockUntil: null });
	if (followSchedule && scheduled(store.operatingHours)) clearOverride(c);
	return finish(store, c, true);
}
