// Walking-time model, ported from rout_hack/03_campus_food_delivery/core/costmodel.py:
//
//   time(A → B) = ground distance / speed + FLOOR_PENALTY × (floor(B) − 1)
//
// Ground distance is the straight line times a detour factor, because
// campus paths are not straight. Replace `travelSeconds` with a lookup on a
// real path graph once one exists; the planner only calls it through
// `TravelFn`, so nothing else has to change.
import type { Place } from './places';

export type TravelFn = (from: Place, to: Place, toFloor?: number) => number;

export interface CostConfig {
	/** Walking speed on campus, m/s */
	speedMps: number;
	/** Straight line → real path length */
	detourFactor: number;
	/** Lift/stairs time per floor above the ground floor, seconds */
	floorPenaltyS: number;
	/** Multiplies every ground leg: 1 = normal, ~1.4 = heavy rain */
	slowdown: number;
}

export const DEFAULT_COST: CostConfig = { speedMps: 1.3, detourFactor: 1.3, floorPenaltyS: 25, slowdown: 1 };

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function distanceMeters(a: Place, b: Place): number {
	const dLat = rad(b.lat - a.lat);
	const dLng = rad(b.lng - a.lng);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function travelFn(cfg: Partial<CostConfig> = {}): TravelFn {
	const c = { ...DEFAULT_COST, ...cfg };
	return (from, to, toFloor = 1) => {
		const ground = from.id === to.id ? 0 : (distanceMeters(from, to) * c.detourFactor * c.slowdown) / c.speedMps;
		return ground + Math.max(0, toFloor - 1) * c.floorPenaltyS;
	};
}
