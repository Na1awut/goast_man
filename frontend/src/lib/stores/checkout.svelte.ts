// Checkout draft shared by the summary and PromptPay screens (Svelte 5 runes)
import type { Order, PaymentMethod } from '$lib/types';
import { promptPayEnabled } from '$lib/payments';
import { lineName, netTotal, promoDiscount, roundUpTip } from '$lib/pricing';
import { campus, dropoffLabel } from './campus.svelte';
import { cart } from './cart.svelte';
import { orders } from './orders.svelte';

class CheckoutStore {
	note = $state('');
	/** PromptPay is the default once it can take real payments; until then cash only (see $lib/payments) */
	payment = $state<PaymentMethod>(promptPayEnabled ? 'PROMPTPAY' : 'CASH');
	/** PromptPay reference, created when the payment screen opens */
	reference = $state('');
	placing = $state(false);

	/** Distance + floor + rain (see cart.deliveryQuote) */
	deliveryFee = $derived(cart.deliveryQuote.fee);
	/** Fee still payable after a partner free-delivery promotion, so GOOSEFREE can't waive it twice */
	feeAfterPromotion = $derived(cart.appliedPromotion?.promotion.freeDelivery ? 0 : this.deliveryFee);
	codeDiscount = $derived(promoDiscount(cart.promo, this.feeAfterPromotion));
	/** Before the tip */
	baseTotal = $derived(
		netTotal({
			foodTotal: cart.subtotal,
			deliveryFee: this.deliveryFee,
			codeDiscount: this.codeDiscount,
			partnerDiscount: cart.partnerDiscount
		})
	);
	/** The buyer said yes to rounding the total up; the difference is a tip for the rider */
	roundUp = $state(false);
	/** What rounding up would add (0 when the total already ends in 0 or 5) */
	tipOffer = $derived(roundUpTip(this.baseTotal));
	tip = $derived(this.roundUp ? this.tipOffer : 0);
	total = $derived(this.baseTotal + this.tip);

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
		if (!store || cart.isEmpty || cart.overLimit || this.placing) return null;
		this.placing = true;
		try {
			const order = await orders.place({
				kind: 'STORE',
				storeId: store.id,
				pickupName: store.name,
				dropoffName: dropoffLabel(campus.dropoff, campus.floor),
				dropoffId: campus.dropoff.id,
				floor: campus.floor,
				itemDetails: cart.items.map((i) => `${lineName(i)} ×${i.quantity}`).join(', '),
				items: cart.items.map((i) => ({ menuItem: i.menuItem, quantity: i.quantity, special: i.special })),
				foodTotal: cart.subtotal,
				deliveryFee: this.deliveryFee,
				codeDiscount: this.codeDiscount,
				partnerDiscount: cart.partnerDiscount,
				promoCode: cart.promo?.code ?? undefined,
				totalPrice: this.total,
				tip: this.tip,
				paymentMethod: this.payment,
				note: this.note.trim() || undefined
			});
			cart.clear();
			this.note = '';
			this.roundUp = false;
			this.reference = '';
			return order;
		} finally {
			this.placing = false;
		}
	}
}

export const checkout = new CheckoutStore();
