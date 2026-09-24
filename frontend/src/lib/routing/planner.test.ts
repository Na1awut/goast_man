import { describe, expect, it } from 'vitest';
import { DROPOFF_POINTS, PICKUP_HUBS } from '$lib/data/locations';
import { STORE_ZONES } from '$lib/data/stores';
import { travelFn, type TravelFn } from './cost';
import { PLACES, STORE_ZONE_PLACE, type Place } from './places';
import { planRoute, suggestAddOns, type Route, type RouteOrder } from './planner';

// A flat test grid: 1 unit of x/y = 1 second of walking, so expectations stay readable
const at = (id: string, x: number, y: number): Place => ({ id, lat: x, lng: y });
const gridTravel: TravelFn = (a, b, floor = 1) => Math.hypot(a.lat - b.lat, a.lng - b.lng) + Math.max(0, floor - 1) * 25;

const home = at('home', 0, 0);
const canteen = at('canteen', 100, 0);
const near = at('near', 150, 0);
const far = at('far', 400, 0);

const order = (id: string, pickup: Place, dropoff: Place, extra: Partial<RouteOrder> = {}): RouteOrder => ({ id, pickup, dropoff, ...extra });

function assertValid(route: Route, orders: RouteOrder[]) {
	for (const o of orders) {
		const p = route.stops.findIndex((s) => s.kind === 'pickup' && s.orderId === o.id);
		const d = route.stops.findIndex((s) => s.kind === 'delivery' && s.orderId === o.id);
		expect(d).toBeGreaterThanOrEqual(0);
		if (o.pickedUp) expect(p).toBe(-1);
		else expect(p).toBeLessThan(d);
		if (o.deadline !== undefined) expect(route.stops[d].arriveAt).toBeLessThanOrEqual(o.deadline + 1e-6);
		if (!o.pickedUp) expect(route.stops[p].arriveAt + route.stops[p].wait).toBeGreaterThanOrEqual((o.readyAt ?? 0) - 1e-6);
	}
}

/** Every valid stop order, tried one by one: the reference the planner must match */
function bruteForce(start: Place, orders: RouteOrder[]): number {
	let best = Infinity;
	const stops = orders.flatMap((o, i) => (o.pickedUp ? [{ i, kind: 'd' }] : [{ i, kind: 'p' }, { i, kind: 'd' }]));
	const permute = (rest: typeof stops, done: typeof stops) => {
		if (rest.length === 0) {
			let here = start;
			let now = 0;
			let travelS = 0;
			const picked = orders.map((o) => !!o.pickedUp);
			for (const s of done) {
				const o = orders[s.i];
				if (s.kind === 'd' && !picked[s.i]) return;
				const to = s.kind === 'p' ? o.pickup : o.dropoff;
				const leg = gridTravel(here, to, s.kind === 'd' ? o.dropoffFloor : 1);
				travelS += leg;
				now += leg;
				if (s.kind === 'p') {
					now = Math.max(now, o.readyAt ?? 0);
					picked[s.i] = true;
				}
				if (now > (o.deadline ?? Infinity)) return;
				here = to;
			}
			best = Math.min(best, travelS);
			return;
		}
		rest.forEach((s, k) => permute([...rest.slice(0, k), ...rest.slice(k + 1)], [...done, s]));
	};
	permute(stops, []);
	return best;
}

describe('planRoute', () => {
	it('collects both meals at the canteen before walking out', () => {
		const orders = [order('a', canteen, far), order('b', canteen, near)];
		const route = planRoute(home, orders, gridTravel, 3)!;
		assertValid(route, orders);
		expect(route.stops.map((s) => `${s.kind[0]}${s.orderId}`)).toEqual(['pa', 'pb', 'db', 'da']);
		expect(route.travelSeconds).toBeCloseTo(400);
	});

	it('waits at the stall until the food is ready', () => {
		const route = planRoute(home, [order('a', canteen, near, { readyAt: 250 })], gridTravel, 3)!;
		expect(route.stops[0]).toMatchObject({ kind: 'pickup', arriveAt: 100, wait: 150 });
		expect(route.finishSeconds).toBeCloseTo(300);
	});

	it('delivers the urgent order first even when that walks further', () => {
		const side = at('side', 450, 150);
		const relaxed = planRoute(home, [order('a', canteen, far), order('b', canteen, side)], gridTravel, 3)!;
		expect(relaxed.stops.find((s) => s.kind === 'delivery')!.orderId).toBe('a');

		const orders = [order('a', canteen, far), order('b', canteen, side, { deadline: 500 })];
		const route = planRoute(home, orders, gridTravel, 3)!;
		assertValid(route, orders);
		expect(route.stops.find((s) => s.kind === 'delivery')!.orderId).toBe('b');
		expect(route.travelSeconds).toBeGreaterThan(relaxed.travelSeconds);
	});

	it('returns null when a deadline cannot be met', () => {
		expect(planRoute(home, [order('a', canteen, far, { deadline: 300 })], gridTravel, 3)).toBeNull();
	});

	it('refuses more orders than the rider can carry', () => {
		const orders = ['a', 'b', 'c'].map((id) => order(id, canteen, near));
		expect(planRoute(home, orders, gridTravel, 2)).toBeNull();
		expect(planRoute(home, orders, gridTravel, 3)).not.toBeNull();
	});

	it('skips the pickup for food already in hand', () => {
		const orders = [order('a', canteen, near, { pickedUp: true })];
		const route = planRoute(canteen, orders, gridTravel, 3)!;
		expect(route.stops.map((s) => s.kind)).toEqual(['delivery']);
	});

	it('charges the floor penalty for upstairs drop-offs', () => {
		const route = planRoute(home, [order('a', canteen, near, { dropoffFloor: 5 })], gridTravel, 3)!;
		expect(route.travelSeconds).toBeCloseTo(150 + 4 * 25);
	});

	it('matches an exhaustive search on random jobs', () => {
		let seed = 7;
		const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 600;
		for (let trial = 0; trial < 40; trial++) {
			const orders = Array.from({ length: 3 + (trial % 2) }, (_, i) =>
				order(`o${i}`, at(`p${trial}-${i}`, rand(), rand()), at(`d${trial}-${i}`, rand(), rand()), {
					readyAt: rand() / 2,
					deadline: trial % 3 === 0 ? 900 + rand() * 2 : undefined,
					dropoffFloor: 1 + (i % 3)
				})
			);
			const route = planRoute(home, orders, gridTravel, 4);
			const reference = bruteForce(home, orders);
			if (reference === Infinity) expect(route).toBeNull();
			else {
				expect(route).not.toBeNull();
				assertValid(route!, orders);
				expect(route!.travelSeconds).toBeCloseTo(reference, 6);
			}
		}
	});
});

describe('suggestAddOns', () => {
	const mine = [order('mine', canteen, far)];
	const onTheWay = order('on-the-way', canteen, near);
	const detour = order('detour', at('south', 100, -300), at('south-2', 100, -350));
	const late = order('late', canteen, near, { deadline: 50 });

	it('ranks jobs on the way first and hides big detours', () => {
		const out = suggestAddOns(home, mine, [detour, onTheWay, late], gridTravel, { capacity: 3, maxExtraSeconds: 120 });
		expect(out.map((s) => s.order.id)).toEqual(['on-the-way']);
		expect(out[0].extraSeconds).toBeCloseTo(0);
		assertValid(out[0].route, [...mine, onTheWay]);
	});

	it('reports how much the add-on delays jobs already held', () => {
		const sideStop = order('side', canteen, at('side', 250, 0));
		const [s] = suggestAddOns(home, [order('mine', canteen, near)], [sideStop], gridTravel, { capacity: 3 });
		expect(s.extraSeconds).toBeCloseTo(100);
		expect(s.maxDelaySeconds).toBeCloseTo(0);
	});

	it('suggests nothing once the rider is out delivering or full', () => {
		expect(suggestAddOns(home, [order('mine', canteen, far, { pickedUp: true })], [onTheWay], gridTravel, { capacity: 3 })).toEqual([]);
		expect(suggestAddOns(home, mine, [onTheWay], gridTravel, { capacity: 1 })).toEqual([]);
	});
});

describe('campus places', () => {
	it('has a place for every pickup hub, drop-off point and store zone', () => {
		for (const { id } of [...PICKUP_HUBS, ...DROPOFF_POINTS]) expect(PLACES[id], id).toBeDefined();
		for (const { id } of STORE_ZONES) if (id !== 'all') expect(PLACES[STORE_ZONE_PLACE[id]], id).toBeDefined();
	});

	it('gives campus walks a sensible length', () => {
		const walk = travelFn()(PLACES['canteen-male'], PLACES['lx-1']);
		expect(walk).toBeGreaterThan(60);
		expect(walk).toBeLessThan(15 * 60);
	});
});
