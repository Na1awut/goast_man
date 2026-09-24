// Browsing state for the store list + detail screens (Svelte 5 runes)
import type { StoreZone } from '$lib/types';
import { catalog } from './catalog.svelte';
import { nav } from './nav.svelte';

class StoreViewStore {
	selectedId = $state<string | null>(null);
	zone = $state<StoreZone | 'all'>('all');
	query = $state('');
	favorites = $state<string[]>([]);
	/** Set by the home search field so the stores screen opens ready to type */
	focusSearch = false;

	selected = $derived(this.selectedId ? catalog.byId(this.selectedId) : undefined);

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
