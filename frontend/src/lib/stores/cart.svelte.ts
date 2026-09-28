// Cart global store (Svelte 5 runes)
import type { CartItem, MenuItem, Store } from '$lib/types';
import { bestPromotion, MAX_ORDER_ITEMS, quoteDelivery, unitPrice, type AppliedCode } from '$lib/pricing';
import { distanceMeters, PLACES, STORE_ZONE_PLACE } from '$lib/routing';
import * as api from '$lib/api/live';
import { isLive } from '$lib/supabase';
import { campus } from './campus.svelte';
import { flags } from './flags.svelte';
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
	/** Discount code applied at checkout; kept here so it survives "add more items" round-trips */
	promo = $state<AppliedCode | null>(null);

	totalItems = $derived(this.items.reduce((sum, i) => sum + i.quantity, 0));
	subtotal = $derived(this.items.reduce((sum, i) => sum + unitPrice(i) * i.quantity, 0));
	/** Delivery fee for this store's canteen to the chosen building and floor (the database decides the same way) */
	deliveryQuote = $derived.by(() => {
		const from = this.store ? PLACES[STORE_ZONE_PLACE[this.store.zone]] : undefined;
		const to = PLACES[campus.dropoff.id];
		return quoteDelivery({ distanceM: from && to ? distanceMeters(from, to) : null, floor: campus.floor, raining: flags.raining });
	});
	/** A rider carries at most MAX_ORDER_ITEMS */
	full = $derived(this.totalItems >= MAX_ORDER_ITEMS);
	overLimit = $derived(this.totalItems > MAX_ORDER_ITEMS);
	/** Best partner promotion for this cart (food discount and/or free delivery) */
	appliedPromotion = $derived(bestPromotion(this.store, this.items, this.deliveryQuote.fee));
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

	/** Returns false when nothing was added (sold out, or the cart is full) */
	add(menuItem: MenuItem, store: Store, special = false): boolean {
		if (!menuItem.isAvailable || (special && !menuItem.specialPrice)) return false;
		const switching = !!this.store && this.store.id !== store.id && this.items.length > 0;
		if (!switching && this.totalItems >= MAX_ORDER_ITEMS) {
			toast.show(`สั่งได้สูงสุด ${MAX_ORDER_ITEMS} ชิ้นต่อออเดอร์ (คนหิ้วถือได้เท่านี้)`, 'info');
			return false;
		}
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
		return true;
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

	/**
	 * Asks whether a discount code can be used right now (does not spend a use;
	 * placing the order does that, for real, with the database as the only judge).
	 * Throws with the database's reason (PROMO_INVALID, PROMO_NOT_STARTED, PROMO_USES_UP).
	 */
	async checkCode(input: string): Promise<AppliedCode> {
		const code = input.trim().toUpperCase();
		if (isLive) return api.checkPromoCode(code);
		// Demo: one illustrative code, so the flow can be tried without a database
		if (code === 'GOOSEFREE') return { code: 'GOOSEFREE', kind: 'FREE_DELIVERY', amount: null };
		throw new Error('PROMO_INVALID');
	}

	/** Refill the cart from a past order; skips items that are sold out now. Returns items added. */
	reorder(store: Store, lines: { menuItemId: string; quantity: number; special?: boolean }[]): number {
		let room = MAX_ORDER_ITEMS;
		const items = lines.flatMap(({ menuItemId, quantity, special }) => {
			const menuItem = store.menuItems.find((m) => m.id === menuItemId && m.isAvailable);
			if (!menuItem || quantity <= 0 || (special && !menuItem.specialPrice) || room <= 0) return [];
			// An old order may hold more than a rider carries now
			const take = Math.min(quantity, room);
			room -= take;
			return [{ menuItem, quantity: take, special: !!special }];
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
