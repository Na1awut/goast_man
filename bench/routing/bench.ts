// Route planner benchmark. Plain Node ≥ 22.6, no dependencies:
//   node --experimental-strip-types bench/routing/bench.ts [--quick]
//
// Campus generator mirrors rout_hack/03_campus_food_delivery/bench/generate_campus.py:
// an 800 m square, stalls clustered within 120 m of a food court, buildings
// scattered with 1-12 floors. Writes bench/routing/instances.json for
// ortools_compare.py.
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { travelFn } from '../../frontend/src/lib/routing/cost.ts';
import { planRoute, suggestAddOns } from '../../frontend/src/lib/routing/planner.ts';
import type { Place } from '../../frontend/src/lib/routing/places.ts';
import type { RouteOrder } from '../../frontend/src/lib/routing/planner.ts';

const QUICK = process.argv.includes('--quick');
const travel = travelFn();
const CAPACITY = 4;
const SLA_S = 2400; // 40 min, same default as the Python PoC

// --- seeded campus ---------------------------------------------------------
function rng(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const LAT0 = 13.65;
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
const point = (id: string, x: number, y: number): Place => ({ id, lat: LAT0 + y / M_PER_DEG_LAT, lng: 100.49 + x / M_PER_DEG_LNG });

interface Campus {
	stores: Place[];
	buildings: { place: Place; floors: number }[];
}

function campus(r: () => number): Campus {
	const stores = Array.from({ length: 25 }, (_, i) => {
		const ang = r() * 2 * Math.PI;
		const rad = r() * 120;
		return point(`s${i}`, 400 + rad * Math.cos(ang), 400 + rad * Math.sin(ang));
	});
	const floorsChoice = [1, 3, 5, 8, 12];
	const buildings = Array.from({ length: 10 }, (_, i) => ({
		place: point(`b${i}`, r() * 800, r() * 800),
		floors: floorsChoice[Math.floor(r() * floorsChoice.length)]
	}));
	return { stores, buildings };
}

function makeOrders(r: () => number, c: Campus, n: number, prefix = 'o'): RouteOrder[] {
	return Array.from({ length: n }, (_, i) => {
		const b = c.buildings[Math.floor(r() * c.buildings.length)];
		return {
			id: `${prefix}${i}`,
			pickup: c.stores[Math.floor(r() * c.stores.length)],
			dropoff: b.place,
			dropoffFloor: 1 + Math.floor(r() * b.floors),
			readyAt: 180 + r() * 420, // prep 3-10 min, as in the PoC
			deadline: SLA_S
		};
	});
}

const start = (r: () => number) => point('start', r() * 800, r() * 800);

// --- helpers ---------------------------------------------------------------
function timed<T>(fn: () => T): [T, number] {
	const t0 = performance.now();
	const out = fn();
	return [out, performance.now() - t0];
}
const pct = (xs: number[], p: number) => {
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? NaN;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
function table(rows: Record<string, string | number>[]) {
	console.table(rows);
}

// --- A: planRoute latency --------------------------------------------------
console.log(`\n=== A. planRoute latency (capacity ${Math.max(6, CAPACITY)}, SLA ${SLA_S / 60} min) ===`);
{
	const rows = [];
	for (let n = 1; n <= 6; n++) {
		const r = rng(100 + n);
		const runs = QUICK ? 20 : n >= 6 ? 100 : 300;
		const ms: number[] = [];
		let feasible = 0;
		for (let k = 0; k < runs; k++) {
			const c = campus(r);
			const [route, t] = timed(() => planRoute(start(r), makeOrders(r, c, n), travel, 6));
			ms.push(t);
			if (route) feasible++;
		}
		rows.push({ orders: n, runs, 'median ms': f(pct(ms, 50), 3), 'p95 ms': f(pct(ms, 95), 3), 'max ms': f(Math.max(...ms), 3), feasible: `${feasible}/${runs}` });
	}
	table(rows);
}

// --- B: suggestAddOns latency ----------------------------------------------
console.log(`\n=== B. suggestAddOns latency (rider holds 2 jobs, capacity ${CAPACITY}, max +5 min) ===`);
{
	const rows = [];
	for (const m of [10, 50, 100, 200]) {
		const r = rng(200 + m);
		const runs = QUICK ? 5 : 50;
		const ms: number[] = [];
		const found: number[] = [];
		for (let k = 0; k < runs; k++) {
			const c = campus(r);
			const current = makeOrders(r, c, 2, 'mine');
			const open = makeOrders(r, c, m, 'open');
			const [out, t] = timed(() => suggestAddOns(start(r), current, open, travel, { capacity: CAPACITY }));
			ms.push(t);
			found.push(out.length);
		}
		rows.push({ 'open jobs': m, runs, 'median ms': f(pct(ms, 50)), 'p95 ms': f(pct(ms, 95)), 'max ms': f(Math.max(...ms)), 'avg suggestions': f(mean(found), 1) });
	}
	table(rows);
}

// --- C: batching vs one job per trip ---------------------------------------
console.log('\n=== C. Batched outing vs one job per trip (same rider, same jobs) ===');
{
	function oneAtATime(from: Place, orders: RouteOrder[]) {
		// Best order to do the jobs one by one: try every permutation (n ≤ 4)
		let best = { finish: Infinity, avgDelivered: Infinity };
		const permute = (rest: RouteOrder[], done: RouteOrder[]) => {
			if (rest.length) return rest.forEach((o, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...done, o]));
			let at = from;
			let now = 0;
			const delivered: number[] = [];
			for (const o of done) {
				now = Math.max(now + travel(at, o.pickup), o.readyAt ?? 0);
				now += travel(o.pickup, o.dropoff, o.dropoffFloor);
				if (now > (o.deadline ?? Infinity)) return;
				delivered.push(now);
				at = o.dropoff;
			}
			if (now < best.finish) best = { finish: now, avgDelivered: mean(delivered) };
		};
		permute(orders, []);
		return best;
	}

	const rows = [];
	for (let n = 2; n <= 4; n++) {
		const r = rng(300 + n);
		const runs = QUICK ? 20 : 300;
		const saveFinish: number[] = [];
		const avgBatched: number[] = [];
		const avgSingle: number[] = [];
		for (let k = 0; k < runs; k++) {
			const c = campus(r);
			const s = start(r);
			const orders = makeOrders(r, c, n);
			const batched = planRoute(s, orders, travel, CAPACITY);
			const single = oneAtATime(s, orders);
			if (!batched || !Number.isFinite(single.finish)) continue;
			saveFinish.push(1 - batched.finishSeconds / single.finish);
			avgBatched.push(mean(batched.stops.filter((x) => x.kind === 'delivery').map((x) => x.arriveAt)));
			avgSingle.push(single.avgDelivered);
		}
		rows.push({
			jobs: n,
			compared: saveFinish.length,
			'rider done sooner': `${f(mean(saveFinish) * 100, 1)}%`,
			'avg customer wait batched (min)': f(mean(avgBatched) / 60, 1),
			'avg customer wait 1-by-1 (min)': f(mean(avgSingle) / 60, 1)
		});
	}
	table(rows);
}

// --- D: export instances for OR-Tools --------------------------------------
{
	const instances = [];
	for (let n = 2; n <= 6; n++) {
		const r = rng(400 + n);
		const runs = QUICK ? 3 : 30;
		for (let k = 0; k < runs; k++) {
			const c = campus(r);
			const s = start(r);
			const orders = makeOrders(r, c, n);
			const [route, ms] = timed(() => planRoute(s, orders, travel, 6));
			// node 0 = start, then pickup/delivery pairs: 2i+1 = pickup of order i, 2i+2 = its delivery
			const nodes = [{ place: s, floor: 1 }, ...orders.flatMap((o) => [{ place: o.pickup, floor: 1 }, { place: o.dropoff, floor: o.dropoffFloor ?? 1 }])];
			instances.push({
				n,
				matrix: nodes.map((a) => nodes.map((b) => travel(a.place, b.place, b.floor))),
				ready: orders.map((o) => o.readyAt ?? 0),
				deadline: orders.map((o) => o.deadline ?? null),
				ours: route ? { travel: route.travelSeconds, finish: route.finishSeconds, ms } : { travel: null, finish: null, ms }
			});
		}
	}
	writeFileSync(new URL('./instances.json', import.meta.url), JSON.stringify(instances));
	console.log(`\nWrote ${instances.length} instances to bench/routing/instances.json for ortools_compare.py`);
}
