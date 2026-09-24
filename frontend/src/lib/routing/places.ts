// Where every pickup hub, drop-off point and store zone sits on campus.
//
// ALL COORDINATES BELOW ARE PLACEHOLDERS, NOT SURVEYED. They only keep the
// planner runnable; route suggestions are only as good as these numbers.
// To replace one: Google Maps → right-click the entrance → copy the
// "lat, lng" pair → paste it here and delete `approximate`.
import type { StoreZone } from '$lib/types';

export interface Place {
	id: string;
	lat: number;
	lng: number;
	/** Still a placeholder, not a surveyed entrance */
	approximate?: boolean;
}

const place = (id: string, lat: number, lng: number): Place => ({ id, lat, lng, approximate: true });

export const PLACES: Record<string, Place> = Object.fromEntries(
	[
		// Pickup hubs (PICKUP_HUBS in data/locations.ts)
		place('canteen-male', 13.6505, 100.4948),
		place('green-canteen', 13.6519, 100.4935),
		place('7eleven-dorm', 13.6488, 100.4955),
		place('soi45', 13.6545, 100.499),
		// Food stalls in the dorm zone (stores with zone 'dorm')
		place('dorm-food', 13.649, 100.4952),
		// Drop-off points (DROPOFF_POINTS in data/locations.ts)
		place('lx-1', 13.6522, 100.4941),
		place('cb2', 13.6511, 100.493),
		place('cb3', 13.6513, 100.4925),
		place('sit', 13.6527, 100.4928),
		place('eng12', 13.65, 100.4935),
		place('lib', 13.6516, 100.4946),
		place('dorm-s5', 13.6485, 100.496),
		place('dorm-s6', 13.6483, 100.4965)
	].map((p) => [p.id, p])
);

/** Pickup place for a store, by the zone it trades in */
export const STORE_ZONE_PLACE: Record<StoreZone, string> = {
	'canteen-male': 'canteen-male',
	'green-canteen': 'green-canteen',
	dorm: 'dorm-food'
};
