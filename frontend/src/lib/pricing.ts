// Pure pricing rules — kept free of UI state so they can be unit-tested
// and mirrored on the backend.
import type { CartItem, Store } from '$lib/types';

export const STORE_DELIVERY_FEE = 15;
export const CUSTOM_DELIVERY_FEE = 20;
/** Upper bound for a custom order: the runner fronts this money in cash */
export const CUSTOM_MAX_PRICE = 1000;

export type PromoCode = 'KMUTTFIRST' | 'GOOSEFREE';

export const PROMO_CODES: Record<PromoCode, { label: string; describe: (fee: number) => string }> = {
	KMUTTFIRST: { label: 'ลด 15 บาท สำหรับออเดอร์แรก', describe: () => 'ลด 15 ฿' },
	GOOSEFREE: { label: 'ฟรีค่าหิ้ว', describe: (fee) => `ฟรีค่าหิ้ว ${fee} ฿` }
};

export function normalizePromo(input: string): PromoCode | null {
	const code = input.trim().toUpperCase();
	return code in PROMO_CODES ? (code as PromoCode) : null;
}

export function promoDiscount(code: PromoCode | null, deliveryFee: number): number {
	if (code === 'KMUTTFIRST') return 15;
	if (code === 'GOOSEFREE') return deliveryFee;
	return 0;
}

export function partnerDiscount(store: Store | null, items: CartItem[]): number {
	if (!store?.deal) return 0;
	const qty = items.reduce((sum, i) => sum + i.quantity, 0);
	return qty >= store.deal.minQty ? store.deal.amount : 0;
}

export function netTotal(parts: {
	foodTotal: number;
	deliveryFee: number;
	codeDiscount: number;
	partnerDiscount: number;
}): number {
	return Math.max(0, parts.foodTotal + parts.deliveryFee - parts.codeDiscount - parts.partnerDiscount);
}
