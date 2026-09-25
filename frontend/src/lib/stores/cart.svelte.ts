// Cart global store (Svelte 5 runes)
import type { CartItem, MenuItem, Store } from '$lib/types';
import { bestPromotion, STORE_DELIVERY_FEE, unitPrice, type PromoCode } from '$lib/pricing';
import { catalog } from './catalog.svelte';
import { toast } from './toast.svelte';

const STORAGE_KEY = 'gooseman_cart';

interface PersistedCart {
	storeId: string;
	items: { menuItemId: string; quantity: number; special?: boolean }[];
}

/** A cart line is one menu item in one size */
const sameLine = (line: CartItem, menuItemId: string, special: boolean) => line.menuItem.id === menuItemId && !!line.special === special;

class CartStore {
	items = $state<CartItem[]>([]);
	storeId = $state<string | null>(null);
	store = $derived(this.storeId ? (catalog.byId(this.storeId) ?? null) : null);
	/** Promo code applied at checkout; kept here so it survives "add more items" round-trips */
	promo = $state<PromoCode | null>(null);

	totalItems = $derived(this.items.reduce((sum, i) => sum + i.quantity, 0));
	subtotal = $derived(this.items.reduce((sum, i) => sum + unitPrice(i) * i.quantity, 0));
	/** Best partner promotion for this cart (food discount and/or free delivery) */
	appliedPromotion = $derived(bestPromotion(this.store, this.items, STORE_DELIVERY_FEE));
	partnerDiscount = $derived(this.appliedPromotion?.saving ?? 0);
	isEmpty = $derived(this.items.length === 0);

	/** Restore from localStorage, re-resolving items against the live catalogue */
	init() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const saved = JSON.parse(raw) as PersistedCart;
			const store = catalog.byId(saved.storeId);
			if (!store) return;
			const items = saved.items
				.map(({ menuItemId, quantity, special }): CartItem | null => {
					const menuItem = store.menuItems.find((m) => m.id === menuItemId && m.isAvailable);
					if (!menuItem || quantity <= 0 || (special && !menuItem.specialPrice)) return null;
					return { menuItem, quantity, special: !!special };
				})
				.filter((i): i is CartItem => i !== null);
			if (items.length) {
				this.storeId = store.id;
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
			items: this.items.map((i) => ({ menuItemId: i.menuItem.id, quantity: i.quantity, special: !!i.special }))
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	}

	add(menuItem: MenuItem, store: Store, special = false) {
		if (!menuItem.isAvailable || (special && !menuItem.specialPrice)) return;
		// One store per order: switching store clears the previous cart
		if (this.store && this.store.id !== store.id && this.items.length > 0) {
			const previous = this.store.name;
			this.items = [];
			toast.show(`เปลี่ยนเป็นร้าน ${store.name} แล้ว ของจาก ${previous} ถูกนำออกจากตะกร้า (สั่งได้ทีละร้าน)`, 'warning', { duration: 4500 });
		}
		this.storeId = store.id;

		const existing = this.items.find((c) => sameLine(c, menuItem.id, special));
		if (existing) {
			existing.quantity += 1;
		} else {
			this.items.push({ menuItem, quantity: 1, special });
		}
		this.#persist();
	}

	decrement(menuItemId: string, special = false) {
		const existing = this.items.find((c) => sameLine(c, menuItemId, special));
		if (!existing) return;
		if (existing.quantity > 1) {
			existing.quantity -= 1;
		} else {
			this.items = this.items.filter((c) => c !== existing);
		}
		if (this.items.length === 0) this.storeId = null;
		this.#persist();
	}

	qty(menuItemId: string, special = false): number {
		return this.items.find((c) => sameLine(c, menuItemId, special))?.quantity ?? 0;
	}

	/** Refill the cart from a past order; skips items that are sold out now. Returns items added. */
	reorder(store: Store, lines: { menuItemId: string; quantity: number; special?: boolean }[]): number {
		const items = lines.flatMap(({ menuItemId, quantity, special }) => {
			const menuItem = store.menuItems.find((m) => m.id === menuItemId && m.isAvailable);
			if (!menuItem || quantity <= 0 || (special && !menuItem.specialPrice)) return [];
			return [{ menuItem, quantity, special: !!special }];
		});
		this.storeId = items.length ? store.id : null;
		this.items = items;
		this.promo = null;
		this.#persist();
		return items.reduce((sum, i) => sum + i.quantity, 0);
	}

	clear() {
		this.items = [];
		this.storeId = null;
		this.promo = null;
		this.#persist();
	}
}

export const cart = new CartStore();
