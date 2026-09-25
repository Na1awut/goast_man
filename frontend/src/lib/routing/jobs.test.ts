import { describe, expect, it } from 'vitest';
import type { RiderJob } from '$lib/types';
import { STORE_CATALOGUE, findStore } from '$lib/data/stores';
import { travelFn } from './cost';
import { DELIVERY_SLA_S, planRound, START_OPTIONS, toRouteOrder } from './jobs';
import { PLACES } from './places';

const NOW = Date.parse('2026-09-24T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const byId = (id: string) => findStore(STORE_CATALOGUE, id);

const job = (extra: Partial<RiderJob>): RiderJob => ({
	id: 'j1',
	orderCode: '#KM-0001',
	kind: 'STORE',
	storeId: 'kfc-05',
	pickupName: 'ร้านข้าวมันไก่ & ข้าวหมกไก่ (HALAL FOODS)',
	dropoffName: 'อาคารเรียนรวม CB2',
	itemDetails: 'ข้าวมันไก่ ×1',
	items: [],
	foodTotal: 55,
	deliveryFee: 15,
	totalPrice: 70,
	paymentMethod: 'CASH',
	status: 'PENDING',
	createdAt: minutesAgo(0),
	...extra
});

describe('toRouteOrder', () => {
	it('maps a store order to its canteen and drop-off building', () => {
		const o = toRouteOrder(job({}), NOW, byId)!;
		expect(o.pickup.id).toBe('kfc-main');
		expect(o.dropoff.id).toBe('cb2');
	});

	it('maps a custom errand to its pickup hub', () => {
		const o = toRouteOrder(job({ kind: 'CUSTOM', storeId: undefined, pickupName: 'เซเว่นหน้าหอใน มจธ.', dropoffName: 'หอพักหญิง S6' }), NOW, byId)!;
		expect([o.pickup.id, o.dropoff.id]).toEqual(['7eleven-dorm', 'dorm-s6']);
		expect(o.readyAt).toBe(0);
	});

	it('counts store prep time from when the order was placed', () => {
		const queue = byId('kfc-05')!.queueMinutes * 60;
		expect(toRouteOrder(job({ createdAt: minutesAgo(2) }), NOW, byId)!.readyAt).toBeCloseTo(queue - 120);
		expect(toRouteOrder(job({ createdAt: minutesAgo(30) }), NOW, byId)!.readyAt).toBe(0);
	});

	it('sets the deadline from the delivery promise and drops it once late', () => {
		expect(toRouteOrder(job({ createdAt: minutesAgo(10) }), NOW, byId)!.deadline).toBeCloseTo(DELIVERY_SLA_S - 600);
		expect(toRouteOrder(job({ createdAt: minutesAgo(45) }), NOW, byId)!.deadline).toBeUndefined();
	});

	it('marks collected food as picked up', () => {
		expect(toRouteOrder(job({ status: 'DELIVERING' }), NOW, byId)!.pickedUp).toBe(true);
	});

	it('returns null for places not on the campus map', () => {
		expect(toRouteOrder(job({ dropoffName: 'ที่ไหนสักแห่ง' }), NOW, byId)).toBeNull();
		expect(toRouteOrder(job({ storeId: 'store-missing' }), NOW, byId)).toBeNull();
	});
});

describe('planRound', () => {
	it('still gives an order when a deadline cannot be met', () => {
		const late = { ...toRouteOrder(job({}), NOW, byId)!, deadline: 1 };
		const route = planRound(PLACES['lx-1'], [late], travelFn(), 4);
		expect(route?.stops.map((s) => s.kind)).toEqual(['pickup', 'delivery']);
	});
});

it('offers every hub and drop-off point as a starting place', () => {
	for (const { id } of START_OPTIONS) expect(PLACES[id], id).toBeDefined();
});
