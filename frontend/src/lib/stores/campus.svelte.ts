// Drop-off location state: building and floor (Svelte 5 runes)
import type { DropoffPoint } from '$lib/types';
import { DEFAULT_DROPOFF, DROPOFF_POINTS } from '$lib/data/locations';
import { MAX_FLOOR } from '$lib/pricing';

const STORAGE_KEY = 'gooseman_dropoff';
const FLOOR_KEY = 'gooseman_floor';

/** "อาคาร SIT ชั้น 5": what the order and the rider see (same as dropoff_label() in the database) */
export const dropoffLabel = (point: Pick<DropoffPoint, 'name'>, floor: number) => `${point.name} ชั้น ${floor}`;

class CampusStore {
	dropoff = $state<DropoffPoint>(DEFAULT_DROPOFF);
	/** Floor to deliver to; above the first costs 1 ฿ a floor */
	floor = $state(1);
	pickerOpen = $state(false);

	/** Short form for headers: "SIT ชั้น 5" */
	label = $derived(`${this.dropoff.shortName} ชั้น ${this.floor}`);

	init() {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			const found = DROPOFF_POINTS.find((p) => p.id === saved);
			if (found) this.dropoff = found;
			const floor = Number(localStorage.getItem(FLOOR_KEY));
			if (Number.isInteger(floor) && floor >= 1 && floor <= MAX_FLOOR) this.floor = floor;
		} catch {
			/* storage blocked */
		}
	}

	select(point: DropoffPoint) {
		this.dropoff = point;
		this.pickerOpen = false;
		try {
			localStorage.setItem(STORAGE_KEY, point.id);
		} catch {
			/* storage blocked */
		}
	}

	setFloor(floor: number) {
		this.floor = Math.min(MAX_FLOOR, Math.max(1, Math.round(floor) || 1));
		try {
			localStorage.setItem(FLOOR_KEY, String(this.floor));
		} catch {
			/* storage blocked */
		}
	}

	openPicker() {
		this.pickerOpen = true;
	}

	closePicker() {
		this.pickerOpen = false;
	}
}

export const campus = new CampusStore();
