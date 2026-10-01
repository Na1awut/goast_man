import type { OperatingHours, Store } from '$lib/types';

/**
 * Calculates Bangkok time (UTC+7) from any Date object.
 */
export function getBangkokDate(date = new Date()): Date {
	const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
	return new Date(utcMs + 7 * 60 * 60 * 1000);
}

/**
 * Checks whether a given Date is within the configured operating hours.
 * Supports:
 * - Specific days of the week (0=Sunday, 1=Monday ... 6=Saturday)
 * - Same-day hours (e.g. 08:00 to 17:00)
 * - Overnight hours (e.g. 18:00 to 02:00)
 */
export function isWithinHours(hours?: OperatingHours | null, date = new Date()): boolean {
	if (!hours || !hours.enabled) return true;

	const bkk = getBangkokDate(date);
	const day = bkk.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

	// Check day of week if configured
	if (hours.days && hours.days.length > 0 && !hours.days.includes(day)) {
		return false;
	}

	const curMinutes = bkk.getHours() * 60 + bkk.getMinutes();

	const [openH, openM] = (hours.openTime || '08:00').split(':').map(Number);
	const [closeH, closeM] = (hours.closeTime || '17:00').split(':').map(Number);

	const openMinutes = (openH || 0) * 60 + (openM || 0);
	const closeMinutes = (closeH || 0) * 60 + (closeM || 0);

	if (openMinutes <= closeMinutes) {
		// Same day: open <= current < close
		return curMinutes >= openMinutes && curMinutes < closeMinutes;
	} else {
		// Overnight: e.g. 18:00 to 02:00
		return curMinutes >= openMinutes || curMinutes < closeMinutes;
	}
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

	const openNow = isWithinHours(hours, date);
	if (openNow) {
		return {
			isOpenNow: true,
			label: 'อยู่ในเวลาทำการ',
			subtext: `จะปิดรับออเดอร์อัตโนมัติเวลา ${hours.closeTime || '17:00'} น.`
		};
	} else {
		return {
			isOpenNow: false,
			label: 'อยู่นอกเวลาทำการ',
			subtext: `จะเปิดรับออเดอร์อัตโนมัติเวลา ${hours.openTime || '08:00'} น.`
		};
	}
}
