// Where the open/closed controls send their requests. The panel (StoreOpenPanel)
// is the same for the shop owner and the team; each side plugs in its own calls,
// and both end in the database's rules, which answer with the new status.
import { catalog } from '$lib/stores/catalog.svelte';
import type { OperatingHours, StoreOpenStatus } from '$lib/types';

export interface OpenApi {
	status(): Promise<StoreOpenStatus>;
	/** Open or close. `hours`: how long to stay open outside the schedule. `reason`/`until`: a team lock. */
	setOpen(open: boolean, opts?: { hours?: number; reason?: string; until?: string | null; rev?: number }): Promise<StoreOpenStatus>;
	/** Owner: drop the hand switch. Team: lift the lock and the hand switch, so the schedule runs the store. */
	followSchedule(rev?: number): Promise<StoreOpenStatus>;
	/** Team only: lift the lock and nothing else */
	release?(rev?: number): Promise<StoreOpenStatus>;
	saveHours(hours: OperatingHours, rev?: number): Promise<StoreOpenStatus>;
}

/** The shop owner's own store (partner_* functions; demo: in memory) */
export const ownerOpenApi = (storeId: string, name: string): OpenApi => ({
	status: () => catalog.openStatus(storeId),
	setOpen: (open, o) => catalog.setStoreOpen(storeId, open, { hours: o?.hours, rev: o?.rev, name }),
	followSchedule: (rev) => catalog.followSchedule(storeId, rev),
	saveHours: (hours, rev) => catalog.saveOperatingHours(storeId, hours, { rev, name })
});
