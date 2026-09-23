// Drop-off location state (Svelte 5 runes)
import type { DropoffPoint } from '$lib/types';
import { DEFAULT_DROPOFF, DROPOFF_POINTS } from '$lib/data/locations';

const STORAGE_KEY = 'gooseman_dropoff';

class CampusStore {
	dropoff = $state<DropoffPoint>(DEFAULT_DROPOFF);
	pickerOpen = $state(false);

	init() {
		const saved = localStorage.getItem(STORAGE_KEY);
		const found = DROPOFF_POINTS.find((p) => p.id === saved);
		if (found) this.dropoff = found;
	}

	select(point: DropoffPoint) {
		this.dropoff = point;
		this.pickerOpen = false;
		localStorage.setItem(STORAGE_KEY, point.id);
	}

	openPicker() {
		this.pickerOpen = true;
	}

	closePicker() {
		this.pickerOpen = false;
	}
}

export const campus = new CampusStore();
