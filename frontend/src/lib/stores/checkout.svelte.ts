// Checkout draft shared by the summary and PromptPay screens (Svelte 5 runes)
import type { Order, PaymentMethod } from '$lib/types';
import { netTotal, promoDiscount, STORE_DELIVERY_FEE } from '$lib/pricing';
import { campus } from './campus.svelte';
import { cart } from './cart.svelte';
import { orders } from './orders.svelte';

class CheckoutStore {
	note = $state('');
	payment = $state<PaymentMethod>('PROMPTPAY');
	/** PromptPay reference, created when the payment screen opens */
	reference = $state('');

	readonly deliveryFee = STORE_DELIVERY_FEE;
	codeDiscount = $derived(promoDiscount(cart.promo, STORE_DELIVERY_FEE));
	total = $derived(
		netTotal({
			foodTotal: cart.subtotal,
			deliveryFee: STORE_DELIVERY_FEE,
			codeDiscount: this.codeDiscount,
			partnerDiscount: cart.partnerDiscount
		})
	);

	startPayment() {
		this.reference = `GM${Date.now().toString().slice(-8)}`;
	}

	/** Turn the cart into an order. Returns null if the cart is empty. */
	place(): Order | null {
		const store = cart.store;
		if (!store || cart.isEmpty) return null;
		const order = orders.place({
			kind: 'STORE',
			storeId: store.id,
			pickupName: store.name,
			dropoffName: campus.dropoff.name,
			itemDetails: cart.items.map((i) => `${i.menuItem.name} ×${i.quantity}`).join(', '),
			items: cart.items.map((i) => ({ menuItem: i.menuItem, quantity: i.quantity })),
			foodTotal: cart.subtotal,
			deliveryFee: this.deliveryFee,
			codeDiscount: this.codeDiscount,
			partnerDiscount: cart.partnerDiscount,
			promoCode: cart.promo ?? undefined,
			totalPrice: this.total,
			paymentMethod: this.payment,
			note: this.note.trim() || undefined
		});
		cart.clear();
		this.note = '';
		this.reference = '';
		return order;
	}
}

export const checkout = new CheckoutStore();
