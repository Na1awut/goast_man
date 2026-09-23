// Cart global store (Svelte 5 runes)
import type { CartItem, MenuItem, Store } from '$lib/types';
import { getStoreById } from '$lib/data/stores';
import { partnerDiscount, type PromoCode } from '$lib/pricing';
import { toast } from './toast.svelte';

const STORAGE_KEY = 'gooseman_cart';

interface PersistedCart {
	storeId: string;
	items: { menuItemId: string; quantity: number }[];
}

class CartStore {
	items = $state<CartItem[]>([]);
	store = $state<Store | null>(null);
	/** Promo code applied at checkout; kept here so it survives "add more items" round-trips */
	promo = $state<PromoCode | null>(null);

	totalItems = $derived(this.items.reduce((sum, i) => sum + i.quantity, 0));
	subtotal = $derived(this.items.reduce((sum, i) => sum + i.menuItem.price * i.quantity, 0));
	partnerDiscount = $derived(partnerDiscount(this.store, this.items));
	isEmpty = $derived(this.items.length === 0);

	/** Restore from localStorage, re-resolving items against the live catalogue */
	init() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const saved = JSON.parse(raw) as PersistedCart;
			const store = getStoreById(saved.storeId);
			if (!store) return;
			const items = saved.items
				.map(({ menuItemId, quantity }) => {
					const menuItem = store.menuItems.find((m) => m.id === menuItemId && m.isAvailable);
					return menuItem && quantity > 0 ? { menuItem, quantity } : null;
				})
				.filter((i): i is CartItem => i !== null);
			if (items.length) {
				this.store = store;
				this.items = items;
			}
		} catch {
			localStorage.removeItem(STORAGE_KEY);
		}
	}

	#persist() {
		if (!this.store || this.items.length === 0) {
			localStorage.removeItem(STORAGE_KEY);
			return;
		}
		const data: PersistedCart = {
			storeId: this.store.id,
			items: this.items.map((i) => ({ menuItemId: i.menuItem.id, quantity: i.quantity }))
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	}

	add(menuItem: MenuItem, store: Store) {
		if (!menuItem.isAvailable) return;
		// One store per order: switching store clears the previous cart
		if (this.store && this.store.id !== store.id && this.items.length > 0) {
			const previous = this.store.name;
			this.items = [];
			toast.show(`เปลี่ยนเป็นร้าน ${store.name} แล้ว ของจาก ${previous} ถูกนำออกจากตะกร้า (สั่งได้ทีละร้าน)`, 'warning', { duration: 4500 });
		}
		this.store = store;

		const existing = this.items.find((c) => c.menuItem.id === menuItem.id);
		if (existing) {
			existing.quantity += 1;
		} else {
			this.items.push({ menuItem, quantity: 1 });
		}
		this.#persist();
	}

	decrement(menuItemId: string) {
		const existing = this.items.find((c) => c.menuItem.id === menuItemId);
		if (!existing) return;
		if (existing.quantity > 1) {
			existing.quantity -= 1;
		} else {
			this.items = this.items.filter((c) => c.menuItem.id !== menuItemId);
		}
		if (this.items.length === 0) this.store = null;
		this.#persist();
	}

	qty(menuItemId: string): number {
		return this.items.find((c) => c.menuItem.id === menuItemId)?.quantity ?? 0;
	}

	/** Refill the cart from a past order; skips items that are sold out now. Returns items added. */
	reorder(store: Store, lines: { menuItemId: string; quantity: number }[]): number {
		const items = lines.flatMap(({ menuItemId, quantity }) => {
			const menuItem = store.menuItems.find((m) => m.id === menuItemId && m.isAvailable);
			return menuItem && quantity > 0 ? [{ menuItem, quantity }] : [];
		});
		this.store = items.length ? store : null;
		this.items = items;
		this.promo = null;
		this.#persist();
		return items.reduce((sum, i) => sum + i.quantity, 0);
	}

	clear() {
		this.items = [];
		this.store = null;
		this.promo = null;
		this.#persist();
	}
}

export const cart = new CartStore();
