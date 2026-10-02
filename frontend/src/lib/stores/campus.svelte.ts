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

	/** Maximum allowed floor for the currently selected location */
	maxFloor = $derived(this.dropoff.maxFloor ?? MAX_FLOOR);

	init() {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			const found = DROPOFF_POINTS.find((p) => p.id === saved);
			if (found) this.dropoff = found;
			// Always default to floor 1
			this.floor = 1;
		} catch {
			/* storage blocked */
		}
	}

	select(point: DropoffPoint) {
		this.dropoff = point;
		// Always reset to floor 1 when picking a location
		this.floor = 1;
		this.pickerOpen = false;
		try {
			localStorage.setItem(STORAGE_KEY, point.id);
			localStorage.setItem(FLOOR_KEY, '1');
		} catch {
			/* storage blocked */
		}
	}

	setFloor(_floor?: number) {
		this.floor = 1;
	}

	openPicker() {
		this.pickerOpen = true;
	}

	closePicker() {
		this.pickerOpen = false;
	}
}

export const campus = new CampusStore();
