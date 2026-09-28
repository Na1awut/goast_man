// Browsing state for the store list + detail screens (Svelte 5 runes)
import type { StoreType, StoreZone } from '$lib/types';
import { STORE_ZONE_TYPE } from '$lib/data/stores';
import { catalog } from './catalog.svelte';
import { nav } from './nav.svelte';

class StoreViewStore {
	selectedId = $state<string | null>(null);
	zone = $state<StoreZone | 'all'>('all');
	type = $state<StoreType | 'all'>('all');
	query = $state('');
	favorites = $state<string[]>([]);
	/** Set by the home search field so the stores screen opens ready to type */
	focusSearch = false;

	selected = $derived(this.selectedId ? catalog.byId(this.selectedId) : undefined);

	browse(type: StoreType | 'all' = 'all') {
		this.type = type;
		this.zone = 'all';
		this.query = '';
		nav.go('STORES');
	}

	selectType(type: StoreType | 'all') {
		this.type = type;
		if (this.zone !== 'all' && type !== 'all' && STORE_ZONE_TYPE[this.zone] !== type) this.zone = 'all';
	}

	clearFilters() {
		this.type = 'all';
		this.zone = 'all';
	}

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
