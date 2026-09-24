// Turns rider jobs from the database into planner input.
//
// Orders store their pickup and drop-off as display names chosen from fixed
// lists (stores, PICKUP_HUBS, DROPOFF_POINTS), so they map back to campus
// places here without extra columns.
import type { RiderJob, Store } from '$lib/types';
import { DROPOFF_POINTS, PICKUP_HUBS } from '$lib/data/locations';
import type { TravelFn } from './cost';
import { PLACES, STORE_ZONE_PLACE, type Place } from './places';
import { planRoute, type Route, type RouteOrder } from './planner';

/** Delivery promise used as the planner's deadline: order placed + 40 min */
export const DELIVERY_SLA_S = 40 * 60;

/** Where a rider can say they are right now */
export const START_OPTIONS = [...PICKUP_HUBS, ...DROPOFF_POINTS].map((p) => ({ id: p.id, label: p.shortName }));

export function pickupPlace(job: RiderJob, findStore: (id: string) => Store | undefined): Place | undefined {
	if (job.kind === 'STORE' && job.storeId) {
		const store = findStore(job.storeId);
		return store ? PLACES[STORE_ZONE_PLACE[store.zone]] : undefined;
	}
	const hub = PICKUP_HUBS.find((h) => h.name === job.pickupName);
	return hub ? PLACES[hub.id] : undefined;
}

export function dropoffPlace(job: RiderJob): Place | undefined {
	const point = DROPOFF_POINTS.find((p) => p.name === job.dropoffName);
	return point ? PLACES[point.id] : undefined;
}

/** Planner input for one job, or null if its pickup or drop-off is not on the campus map */
export function toRouteOrder(job: RiderJob, nowMs: number, findStore: (id: string) => Store | undefined): RouteOrder | null {
	const pickup = pickupPlace(job, findStore);
	const dropoff = dropoffPlace(job);
	if (!pickup || !dropoff) return null;
	const ageS = (nowMs - Date.parse(job.createdAt)) / 1000;
	// Store food takes the store's usual queue time; custom errands are ready to buy now
	const prepS = job.kind === 'STORE' && job.storeId ? (findStore(job.storeId)?.queueMinutes ?? 0) * 60 : 0;
	const deadline = DELIVERY_SLA_S - ageS;
	return {
		id: job.id,
		pickup,
		dropoff,
		readyAt: Math.max(0, prepS - ageS),
		// Already late: plan the fastest order anyway instead of giving up
		deadline: deadline > 0 ? deadline : undefined,
		pickedUp: job.status === 'DELIVERING'
	};
}

/** Best stop order for a round; if deadlines make it impossible, still return the shortest walk */
export function planRound(start: Place, orders: RouteOrder[], travel: TravelFn, capacity: number): Route | null {
	return planRoute(start, orders, travel, capacity) ?? planRoute(start, orders.map((o) => ({ ...o, deadline: undefined })), travel, capacity);
}
