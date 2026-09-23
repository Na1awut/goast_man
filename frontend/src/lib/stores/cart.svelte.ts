// Cart global store (Svelte 5 runes)
import type { CartItem, MenuItem, Store } from '$lib/types';
import { showToast } from './toast.svelte';

// --- State ---
let items = $state<CartItem[]>([]);
let selectedStore = $state<Store | null>(null);

// --- Init from localStorage ---
export function initCart() {
	if (typeof window === 'undefined') return;
	const saved = localStorage.getItem('modman_cart');
	const savedStore = localStorage.getItem('modman_cart_store');
	if (saved) {
		try { items = JSON.parse(saved); } catch { items = []; }
	}
	if (savedStore) {
		try { selectedStore = JSON.parse(savedStore); } catch { selectedStore = null; }
	}
}

function persistCart() {
	if (typeof window === 'undefined') return;
	localStorage.setItem('modman_cart', JSON.stringify(items));
	if (selectedStore) {
		localStorage.setItem('modman_cart_store', JSON.stringify(selectedStore));
	} else {
		localStorage.removeItem('modman_cart_store');
	}
}

// --- Actions ---
export function addToCart(menuItem: MenuItem, store: Store) {
	// If adding from a different store, clear cart first
	if (selectedStore && selectedStore.id !== store.id) {
		items = [];
		selectedStore = store;
		showToast(`🔄 เปลี่ยนร้านเป็น "${store.name}" ตะกร้าเดิมถูกล้าง`);
	}
	if (!selectedStore) {
		selectedStore = store;
	}

	const idx = items.findIndex(c => c.menuItem.id === menuItem.id);
	if (idx > -1) {
		items[idx].quantity += 1;
	} else {
		items.push({ menuItem, quantity: 1 });
	}
	persistCart();
	showToast(`➕ เพิ่ม "${menuItem.name}" ในตะกร้าแล้ว`);
}

export function removeFromCart(menuItemId: string) {
	const idx = items.findIndex(c => c.menuItem.id === menuItemId);
	if (idx > -1) {
		if (items[idx].quantity > 1) {
			items[idx].quantity -= 1;
		} else {
			items.splice(idx, 1);
		}
		if (items.length === 0) {
			selectedStore = null;
		}
		persistCart();
	}
}

export function clearCart() {
	items = [];
	selectedStore = null;
	persistCart();
}

export function getItemQty(menuItemId: string): number {
	const found = items.find(c => c.menuItem.id === menuItemId);
	return found ? found.quantity : 0;
}

// --- Getters ---
export function getCartItems(): CartItem[] {
	return items;
}

export function getCartStore(): Store | null {
	return selectedStore;
}

export function getCartTotalItems(): number {
	return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartSubtotal(): number {
	return items.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
}
