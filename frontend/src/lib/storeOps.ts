// Where a store edit goes. The store screens (menu, details, storefront) are
// shared by a partner editing their own store and the team editing any store
// from the console; they call these, and each side plugs in its own.
import type { StorefrontDraft } from '$lib/stores/catalog.svelte';
import { catalog } from '$lib/stores/catalog.svelte';
import type { MenuItemArgs } from '$lib/api/live';
import type { OperatingHours } from '$lib/types';

export type MenuDraft = Omit<MenuItemArgs, 'imageUrl'> & { imageUrl: string; photoFile?: File | null };
export interface StoreInfo {
	name: string;
	category: string;
	description: string;
	queueMinutes: number;
}

export interface StoreOps {
	saveMenuItem(storeId: string, draft: MenuDraft): Promise<void>;
	removeMenuItem(storeId: string, itemId: string): Promise<void>;
	setItemAvailable(storeId: string, itemId: string, available: boolean): Promise<void>;
	updateStoreInfo(storeId: string, info: StoreInfo): Promise<void>;
	updateStorefront(storeId: string, draft: StorefrontDraft): Promise<void>;
	saveOperatingHours?(storeId: string, hours: OperatingHours): Promise<void>;
}

/** A partner editing their own store (partner_* functions; demo: in memory) */
export const partnerOps: StoreOps = {
	saveMenuItem: (storeId, draft) => catalog.saveMenuItem(storeId, draft),
	removeMenuItem: (storeId, itemId) => catalog.removeMenuItem(storeId, itemId),
	setItemAvailable: (storeId, itemId, available) => catalog.setItemAvailable(storeId, itemId, available),
	updateStoreInfo: (storeId, info) => catalog.updateStoreInfo(storeId, info),
	updateStorefront: (storeId, draft) => catalog.updateStorefront(storeId, draft),
	saveOperatingHours: (storeId, hours) => catalog.saveOperatingHours(storeId, hours)
};

