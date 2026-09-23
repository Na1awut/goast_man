// Browsing state for the store list + detail screens (Svelte 5 runes)
import type { StoreZone } from '$lib/types';
import { getStoreById, MOCK_STORES } from '$lib/data/stores';
import { nav } from './nav.svelte';

class StoreViewStore {
	selectedId = $state(MOCK_STORES[0].id);
	zone = $state<StoreZone | 'all'>('all');
	query = $state('');
	favorites = $state<string[]>([]);
	/** Set by the home search field so the stores screen opens ready to type */
	focusSearch = false;

	selected = $derived(getStoreById(this.selectedId) ?? MOCK_STORES[0]);

	toggleFavorite(storeId: string) {
		this.favorites = this.favorites.includes(storeId)
			? this.favorites.filter((id) => id !== storeId)
			: [...this.favorites, storeId];
	}

	open(storeId: string) {
		this.selectedId = storeId;
		nav.go('STORE_DETAIL');
	}
}

export const storeView = new StoreViewStore();
