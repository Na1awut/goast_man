import { describe, expect, it } from 'vitest';
import cases from '../../tests/open-hours-cases.json';
import { isWithinHours, formatDaysText, describeSchedule, nextScheduleChange, formatWhen } from './operatingHours';
import type { OperatingHours } from './types';

describe('operatingHours', () => {
	it('treats disabled hours as always open', () => {
		const hours: OperatingHours = {
			enabled: false,
			openTime: '08:00',
			closeTime: '17:00'
		};
		expect(isWithinHours(hours, new Date())).toBe(true);
	});

	it('correctly checks daytime hours in Bangkok time', () => {
		const hours: OperatingHours = {
			enabled: true,
			openTime: '08:00',
			closeTime: '17:00'
		};

		// 10:00 Bangkok time (03:00 UTC) -> should be open
		const morning = new Date('2026-10-02T03:00:00.000Z');
		expect(isWithinHours(hours, morning)).toBe(true);

		// 18:00 Bangkok time (11:00 UTC) -> should be closed
		const evening = new Date('2026-10-02T11:00:00.000Z');
		expect(isWithinHours(hours, evening)).toBe(false);

		// 07:30 Bangkok time (00:30 UTC) -> should be closed
		const early = new Date('2026-10-02T00:30:00.000Z');
		expect(isWithinHours(hours, early)).toBe(false);
	});

	it('handles overnight hours (e.g. 18:00 to 02:00)', () => {
		const hours: OperatingHours = {
			enabled: true,
			openTime: '18:00',
			closeTime: '02:00'
		};

		// 20:00 Bangkok time (13:00 UTC) -> should be open
		const night = new Date('2026-10-02T13:00:00.000Z');
		expect(isWithinHours(hours, night)).toBe(true);

		// 01:30 Bangkok time (18:30 UTC previous day) -> should be open
		const midnight = new Date('2026-10-02T18:30:00.000Z');
		expect(isWithinHours(hours, midnight)).toBe(true);

		// 12:00 noon Bangkok time (05:00 UTC) -> should be closed
		const noon = new Date('2026-10-02T05:00:00.000Z');
		expect(isWithinHours(hours, noon)).toBe(false);
	});

	it('respects day of week filters', () => {
		// 2026-10-02 is a Friday (day 5)
		const fridayOnly: OperatingHours = {
			enabled: true,
			openTime: '08:00',
			closeTime: '17:00',
			days: [5]
		};
		const fridayTime = new Date('2026-10-02T03:00:00.000Z'); // 10:00 BKK Friday
		expect(isWithinHours(fridayOnly, fridayTime)).toBe(true);

		const weekendOnly: OperatingHours = {
			enabled: true,
			openTime: '08:00',
			closeTime: '17:00',
			days: [0, 6] // Sun, Sat
		};
		expect(isWithinHours(weekendOnly, fridayTime)).toBe(false);
	});

	it('formats day text correctly', () => {
		expect(formatDaysText([])).toBe('ทุกวัน');
		expect(formatDaysText([1, 2, 3, 4, 5])).toBe('จันทร์ - ศุกร์');
		expect(formatDaysText([1, 3, 5])).toBe('จ, พ, ศ');
	});

	it('describes schedule status accurately', () => {
		const hours: OperatingHours = {
			enabled: true,
			openTime: '08:00',
			closeTime: '17:00'
		};
		const openTime = new Date('2026-10-02T03:00:00.000Z');
		const descOpen = describeSchedule(hours, openTime);
		expect(descOpen.isOpenNow).toBe(true);
		expect(descOpen.label).toBe('อยู่ในเวลาทำการ');

		const closedTime = new Date('2026-10-02T12:00:00.000Z');
		const descClosed = describeSchedule(hours, closedTime);
		expect(descClosed.isOpenNow).toBe(false);
		expect(descClosed.label).toBe('อยู่นอกเวลาทำการ');
	});

	// The same cases the database runs (tests/sql.mjs): the app and the server must agree
	describe('same answers as the database', () => {
		for (const c of cases) {
			it(c.name, () => {
				const at = new Date(c.at);
				const hours = c.hours as OperatingHours | null;
				expect(isWithinHours(hours, at)).toBe(c.open);
				expect(nextScheduleChange(hours, at)?.toISOString().replace('.000Z', 'Z') ?? null).toBe(c.next);
			});
		}
	});

	it('says when in words', () => {
		const now = new Date('2026-10-02T03:00:00.000Z'); // Friday 10:00 Bangkok
		expect(formatWhen(new Date('2026-10-02T10:00:00.000Z'), now)).toBe('17:00 น.');
		expect(formatWhen(new Date('2026-10-03T01:00:00.000Z'), now)).toBe('พรุ่งนี้ 08:00 น.');
		expect(formatWhen(new Date('2026-10-05T01:00:00.000Z'), now)).toBe('วันจันทร์ 08:00 น.');
	});
});
