// Where every pickup hub, drop-off point and store zone sits on campus.
//
// MEASURED FROM THE KMUTT MASTER PLAN, NOT SURVEYED ON FOOT.
// Source: "KMUTT Master Plan (Bangmod Campus)", Office of Building and Ground
// Management, update Aug 2563. Each point is the building's middle (or its
// food-centre icon) on the plan, converted with the plan's scale bar
// (100 m = 199.5 px on the 2560 px image) and north arrow (north points
// right, 9.7° below horizontal). The whole set is pinned to the central pond
// at 13.6511, 100.4944 (the campus's published coordinates).
//
// What that means for accuracy: distances and directions between points are
// good to about 10-20 m, which is what the planner uses. The absolute position
// may be off by more, but that shifts every point together and changes no
// walking time. To survey one: Google Maps → long-press the entrance → copy
// "lat, lng" → paste it here and delete `approximate`.
import type { StoreZone } from '$lib/types';

export interface Place {
	id: string;
	lat: number;
	lng: number;
	/** Not surveyed at the entrance (measured from the master plan, or a guess where noted) */
	approximate?: boolean;
}

const place = (id: string, lat: number, lng: number): Place => ({ id, lat, lng, approximate: true });

export const PLACES: Record<string, Place> = Object.fromEntries(
	[
		// Pickup hubs (PICKUP_HUBS in data/locations.ts)
		place('kfc-main', 13.6503, 100.49178), // S14, at its food-centre icon
		// โรงอาหารหอหญิง: taken at the S6 (female dorm) building point until someone surveys the canteen door
		place('female-dorm', 13.64874, 100.4949),
		place('cb1', 13.65115, 100.493), // N20 Classroom Building 1; building centre, not the shop entrance
		// NOT PLACED YET: which building is โรงชาย is unknown, so it sits on KFC (S14) until someone says
		place('canteen-male', 13.6503, 100.49178),
		// S14 is the King Mongkut's 190th Anniversary building, so Green Canteen 190 ปี is taken to share it with KFC
		place('green-canteen', 13.6503, 100.49178),
		place('7eleven-dorm', 13.64868, 100.49501), // 7-Eleven icon at S6
		// Off the master plan: a guess 250 m past Gate 1 along Pracha Uthit Road
		place('soi45', 13.65108, 100.49876),
		// Food stalls in the dorm zone (stores with zone 'dorm'): between the S5 and S6 food icons
		place('dorm-food', 13.64897, 100.49471),
		// Drop-off points (DROPOFF_POINTS in data/locations.ts)
		place('lx-1', 13.65163, 100.49389), // N16 Learning Exchange
		place('cb2', 13.65123, 100.49344), // N17 Classroom Building 2
		place('cb3', 13.64932, 100.49203), // S13 Classroom Building 3
		place('sit', 13.65225, 100.49333), // N11 School of Information Technology
		place('eng12', 13.64975, 100.49424), // S4 Wissawa Wattana (engineering 12 floors)
		place('lib', 13.65282, 100.49362), // N10 Library
		place('dorm-s5', 13.6492, 100.49467), // S5 Dhammaraksa 2 (male)
		place('dorm-s6', 13.64874, 100.4949) // S6 Dhammaraksa 1 (female)
	].map((p) => [p.id, p])
);

/** Pickup place for a store, by the zone it trades in */
export const STORE_ZONE_PLACE: Record<StoreZone, string> = {
	'kfc-main': 'kfc-main',
	'female-dorm': 'female-dorm',
	cb1: 'cb1',
	'canteen-male': 'canteen-male',
	'green-canteen': 'green-canteen',
	dorm: 'dorm-food'
};
