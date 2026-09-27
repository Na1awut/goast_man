// Switches the team sets from the console that change what buyers pay (rain fee)
import * as api from '$lib/api/live';
import { isLive } from '$lib/supabase';

class FlagsStore {
	/** The team switched the rain fee on */
	raining = $state(false);

	/** Fresh values from the database; demo mode has no switches */
	async load() {
		if (!isLive) return;
		try {
			this.raining = !!(await api.fetchAppFlags()).rain_surcharge;
		} catch {
			/* before the migration, or offline: keep the last value */
		}
	}
}

export const flags = new FlagsStore();
