// Formatting for the team console: Thai labels, Bangkok time, baht.

const BKK = 'Asia/Bangkok';

/** 18420 → "฿18,420" (the console shows money like the approved design) */
export function baht(amount: number | null | undefined): string {
	return `฿${Math.round(amount ?? 0).toLocaleString('en-US')}`;
}

/** 18420 → "18,420" */
export function count(n: number | null | undefined): string {
	return Math.round(n ?? 0).toLocaleString('en-US');
}

/** ISO → "12:04" in Bangkok time */
export function clock(iso: string | null | undefined): string {
	if (!iso) return '';
	return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: BKK });
}

/** "2026-09-26" or ISO → "26 ก.ย. 2569" */
export function thaiDate(value: string | Date, withYear = true): string {
	const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+07:00`) : new Date(value);
	return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: BKK });
}

/** ISO → "26 ก.ย. 12:04" */
export function dateTime(iso: string | null | undefined): string {
	if (!iso) return '';
	return `${thaiDate(iso, false)} ${clock(iso)}`;
}

/** Minutes since an ISO time, never negative */
export function minutesSince(iso: string, now = Date.now()): number {
	return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

/** 6 → "6 นาทีที่แล้ว", 0 → "เมื่อสักครู่", 75 → "1 ชม. 15 นาทีที่แล้ว" */
export function ago(iso: string, now = Date.now()): string {
	const m = minutesSince(iso, now);
	if (m < 1) return 'เมื่อสักครู่';
	if (m < 60) return `${m} นาทีที่แล้ว`;
	if (m < 24 * 60) return `${Math.floor(m / 60)} ชม.${m % 60 ? ` ${m % 60} นาที` : ''}ที่แล้ว`;
	return thaiDate(iso, false);
}

/** Today in Bangkok as "YYYY-MM-DD" */
export function bangkokToday(now = new Date()): string {
	return now.toLocaleDateString('en-CA', { timeZone: BKK });
}

/** 0812345678 → "081-234-5678"; 13-digit IDs and anything else stay as they are */
export function phone(value: string | null | undefined): string {
	const d = (value ?? '').replace(/\D/g, '');
	return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : (value ?? '');
}
