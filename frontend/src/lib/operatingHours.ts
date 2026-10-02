import type { OperatingHours } from '$lib/types';

// The weekly schedule. The database is the one that opens and closes stores (see
// supabase/migrations/20261031000000_store_open_control.sql); this file is the same
// rule in TypeScript, for showing "opens at ..." and for demo mode. Both are tested
// against the same cases (tests/open-hours-cases.json). All times are Bangkok time.

const BKK_OFFSET_MS = 7 * 3600_000;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Bangkok wall-clock parts of an instant */
function bkk(date: Date) {
	const d = new Date(date.getTime() + BKK_OFFSET_MS);
	return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), dow: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

/** Calculates Bangkok time (UTC+7) from any Date object: the returned Date's *UTC* fields are the Bangkok clock. */
export function getBangkokDate(date = new Date()): Date {
	return new Date(date.getTime() + BKK_OFFSET_MS);
}

function parse(hours: OperatingHours) {
	const o = TIME_RE.test(hours.openTime ?? '') ? hours.openTime : '08:00';
	const c = TIME_RE.test(hours.closeTime ?? '') ? hours.closeTime : '17:00';
	const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
	let days = Array.isArray(hours.days) ? hours.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [];
	if (days.length === 0) days = [0, 1, 2, 3, 4, 5, 6];
	return { open: minutes(o), close: minutes(c), days };
}

/**
 * Is the schedule open at this moment? Not enabled = no schedule = true.
 * A session belongs to the day it starts: 18:00-02:00 on Friday runs until Saturday 02:00.
 * Days: 0 = Sunday ... 6 = Saturday; none = every day.
 */
export function isWithinHours(hours?: OperatingHours | null, date = new Date()): boolean {
	if (!hours || !hours.enabled) return true;
	const { open, close, days } = parse(hours);
	const { dow, min } = bkk(date);
	if (open <= close) return days.includes(dow) && min >= open && min < close;
	// Overnight: tonight's session, or the tail of yesterday's
	return (days.includes(dow) && min >= open) || (days.includes((dow + 6) % 7) && min < close);
}

/** The next moment after `date` the schedule changes between open and closed; null if there is no schedule or it never changes */
export function nextScheduleChange(hours?: OperatingHours | null, date = new Date()): Date | null {
	if (!hours || !hours.enabled) return null;
	const { open, close, days } = parse(hours);
	const now = isWithinHours(hours, date);
	const today = bkk(date);
	const at = (dayOffset: number, minutes: number) => new Date(Date.UTC(today.y, today.m, today.day + dayOffset, 0, minutes) - BKK_OFFSET_MS);
	const candidates: Date[] = [];
	for (let i = -1; i <= 8; i++) {
		const dow = new Date(Date.UTC(today.y, today.m, today.day + i)).getUTCDay();
		if (!days.includes(dow)) continue;
		candidates.push(at(i, open), at(i + (open <= close ? 0 : 1), close));
	}
	candidates.sort((a, b) => a.getTime() - b.getTime());
	return candidates.find((t) => t.getTime() > date.getTime() && isWithinHours(hours, t) !== now) ?? null;
}

/**
 * Formats day numbers into friendly Thai day names.
 */
export function formatDaysText(days?: number[]): string {
	if (!days || days.length === 0 || days.length === 7) return 'ทุกวัน';
	const weekdays = [1, 2, 3, 4, 5];
	if (days.length === 5 && weekdays.every((d) => days.includes(d))) {
		return 'จันทร์ - ศุกร์';
	}
	const names: Record<number, string> = {
		0: 'อา',
		1: 'จ',
		2: 'อ',
		3: 'พ',
		4: 'พฤ',
		5: 'ศ',
		6: 'ส'
	};
	return days.map((d) => names[d] ?? '').filter(Boolean).join(', ');
}

const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/** "17:00 น.", "พรุ่งนี้ 08:00 น." or "วันจันทร์ 08:00 น." for an instant, as seen from `now` */
export function formatWhen(when: Date | string, now = new Date()): string {
	const t = typeof when === 'string' ? new Date(when) : when;
	const w = bkk(t);
	const n = bkk(now);
	const hhmm = `${String(Math.floor(w.min / 60)).padStart(2, '0')}:${String(w.min % 60).padStart(2, '0')} น.`;
	const dayDiff = Math.round((Date.UTC(w.y, w.m, w.day) - Date.UTC(n.y, n.m, n.day)) / 86_400_000);
	if (dayDiff === 0) return hhmm;
	if (dayDiff === 1) return `พรุ่งนี้ ${hhmm}`;
	return `วัน${DAY_NAMES[w.dow]} ${hhmm}`;
}

/**
 * Human-friendly schedule status summary for store UI.
 */
export function describeSchedule(
	hours?: OperatingHours | null,
	date = new Date()
): { isOpenNow: boolean; label: string; subtext: string } {
	if (!hours || !hours.enabled) {
		return {
			isOpenNow: true,
			label: 'เปิด-ปิดด้วยตนเอง',
			subtext: 'ไม่ได้เปิดระบบตั้งเวลาอัตโนมัติ'
		};
	}

	const next = nextScheduleChange(hours, date);
	const when = next ? formatWhen(next, date) : '';
	if (isWithinHours(hours, date)) {
		return {
			isOpenNow: true,
			label: 'อยู่ในเวลาทำการ',
			subtext: when ? `จะปิดรับออเดอร์อัตโนมัติ ${when}` : 'เปิดรับออเดอร์ตามเวลาที่ตั้งไว้'
		};
	}
	return {
		isOpenNow: false,
		label: 'อยู่นอกเวลาทำการ',
		subtext: when ? `จะเปิดรับออเดอร์อัตโนมัติ ${when}` : 'ปิดรับออเดอร์ตามเวลาที่ตั้งไว้'
	};
}
