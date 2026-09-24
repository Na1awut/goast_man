// Route planning for one rider, ported from the OR-Tools PDPTW in
// rout_hack/03_campus_food_delivery/core/pdp_solver.py.
//
// Goose Man riders pick their own jobs, so there is no central dispatcher
// here: the planner sequences the jobs one rider already holds, and scores
// open jobs they could add. A rider holds a handful of orders at most, so
// every valid stop order is searched exhaustively and the answer is exact.
//
// Same hard constraints as the Python solver:
//   1. an order's pickup comes before its delivery
//   2. at most `capacity` orders per outing
//   3. no pickup before the food is ready (the rider waits)
//   4. no delivery after the order's deadline
// Once a rider has started delivering, the outing is closed: no new pickups.
import type { Place } from './places';
import type { TravelFn } from './cost';

export interface RouteOrder {
	id: string;
	pickup: Place;
	dropoff: Place;
	dropoffFloor?: number;
	/** Seconds from now until the food is ready. Default: ready now */
	readyAt?: number;
	/** Seconds from now by which it must be delivered. Default: no deadline */
	deadline?: number;
	/** Already in the rider's hands: no pickup stop */
	pickedUp?: boolean;
}

export interface RouteStop {
	kind: 'pickup' | 'delivery';
	orderId: string;
	place: Place;
	/** Seconds from now */
	arriveAt: number;
	/** Seconds spent waiting for the food */
	wait: number;
}

export interface Route {
	stops: RouteStop[];
	/** Walking time only */
	travelSeconds: number;
	/** When the last delivery lands, seconds from now */
	finishSeconds: number;
}

/** Exhaustive search grows fast; riders never carry this many */
export const MAX_PLAN_ORDERS = 6;

export function planRoute(start: Place, orders: RouteOrder[], travel: TravelFn, capacity: number): Route | null {
	if (orders.length === 0) return { stops: [], travelSeconds: 0, finishSeconds: 0 };
	if (orders.length > capacity || orders.length > MAX_PLAN_ORDERS) return null;

	const picked = orders.map((o) => !!o.pickedUp);
	const delivered = orders.map(() => false);
	const path: RouteStop[] = [];
	let best: Route | null = null;

	const better = (travelS: number, finishS: number) =>
		!best || travelS < best.travelSeconds - 1e-9 || (Math.abs(travelS - best.travelSeconds) <= 1e-9 && finishS < best.finishSeconds);

	function search(at: Place, now: number, travelS: number, left: number) {
		if (best && travelS > best.travelSeconds + 1e-9) return;
		if (left === 0) {
			if (better(travelS, now)) best = { stops: [...path], travelSeconds: travelS, finishSeconds: now };
			return;
		}
		orders.forEach((o, i) => {
			if (delivered[i]) return;
			if (!picked[i]) {
				const leg = travel(at, o.pickup);
				const arrive = now + leg;
				const depart = Math.max(arrive, o.readyAt ?? 0);
				if (depart > (o.deadline ?? Infinity)) return; // can't even collect it in time
				picked[i] = true;
				path.push({ kind: 'pickup', orderId: o.id, place: o.pickup, arriveAt: arrive, wait: depart - arrive });
				search(o.pickup, depart, travelS + leg, left);
				path.pop();
				picked[i] = false;
			} else {
				const leg = travel(at, o.dropoff, o.dropoffFloor);
				const arrive = now + leg;
				if (arrive > (o.deadline ?? Infinity)) return;
				delivered[i] = true;
				path.push({ kind: 'delivery', orderId: o.id, place: o.dropoff, arriveAt: arrive, wait: 0 });
				search(o.dropoff, arrive, travelS + leg, left - 1);
				path.pop();
				delivered[i] = false;
			}
		});
	}

	search(start, 0, 0, orders.length);
	return best;
}

export interface AddOnSuggestion {
	order: RouteOrder;
	route: Route;
	/** How much later the rider finishes by taking this job too */
	extraSeconds: number;
	/** Largest delay this causes to a job the rider already holds */
	maxDelaySeconds: number;
}

export interface SuggestOptions {
	capacity: number;
	/** Hide jobs that add more than this. Default 5 minutes */
	maxExtraSeconds?: number;
}

/** Open jobs worth taking on the way, cheapest first */
export function suggestAddOns(
	start: Place,
	current: RouteOrder[],
	candidates: RouteOrder[],
	travel: TravelFn,
	{ capacity, maxExtraSeconds = 300 }: SuggestOptions
): AddOnSuggestion[] {
	// One outing per round: once food is in hand, no going back for more
	if (current.length >= capacity || current.some((o) => o.pickedUp)) return [];
	const base = planRoute(start, current, travel, capacity);
	if (!base) return [];
	const baseArrival = deliveryTimes(base);

	const suggestions: AddOnSuggestion[] = [];
	for (const order of candidates) {
		if (order.pickedUp || current.some((o) => o.id === order.id)) continue;
		const route = planRoute(start, [...current, order], travel, capacity);
		if (!route) continue;
		const extraSeconds = route.finishSeconds - base.finishSeconds;
		if (extraSeconds > maxExtraSeconds) continue;
		const arrival = deliveryTimes(route);
		const maxDelaySeconds = Math.max(0, ...current.map((o) => arrival.get(o.id)! - baseArrival.get(o.id)!));
		suggestions.push({ order, route, extraSeconds, maxDelaySeconds });
	}
	return suggestions.sort((a, b) => a.extraSeconds - b.extraSeconds || a.maxDelaySeconds - b.maxDelaySeconds);
}

function deliveryTimes(route: Route): Map<string, number> {
	return new Map(route.stops.filter((s) => s.kind === 'delivery').map((s) => [s.orderId, s.arriveAt]));
}
