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
	placing = $state(false);

	readonly deliveryFee = STORE_DELIVERY_FEE;
	/** Fee still payable after a partner free-delivery promotion, so GOOSEFREE can't waive it twice */
	feeAfterPromotion = $derived(cart.appliedPromotion?.promotion.freeDelivery ? 0 : STORE_DELIVERY_FEE);
	codeDiscount = $derived(promoDiscount(cart.promo, this.feeAfterPromotion));
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

	/**
	 * Turn the cart into an order. The cart is only cleared once the order
	 * exists, so a failed request never loses what the student picked.
	 * Throws OrderError with a user-facing message.
	 */
	async place(): Promise<Order | null> {
		const store = cart.store;
		if (!store || cart.isEmpty || this.placing) return null;
		this.placing = true;
		try {
			const order = await orders.place({
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
		} finally {
			this.placing = false;
		}
	}
}

export const checkout = new CheckoutStore();
