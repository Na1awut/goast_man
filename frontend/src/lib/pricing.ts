// Pure pricing rules — kept free of UI state so they can be unit-tested
// and mirrored on the backend.
import type { CartItem, Promotion, Store } from '$lib/types';
import { livePromotions } from '$lib/data/stores';

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

/** `deliveryFee` is the fee still payable after any partner free-delivery promotion */
/** Price of one unit of a cart line: the พิเศษ size when chosen and offered */
export function unitPrice(line: Pick<CartItem, 'menuItem' | 'special'>): number {
	return line.special && line.menuItem.specialPrice ? line.menuItem.specialPrice : line.menuItem.price;
}

/** Display name of a cart line, with the size when it is พิเศษ */
export function lineName(line: Pick<CartItem, 'menuItem' | 'special'>): string {
	return line.special && line.menuItem.specialPrice ? `${line.menuItem.name} (พิเศษ)` : line.menuItem.name;
}

export function promoDiscount(code: PromoCode | null, deliveryFee: number): number {
	if (code === 'KMUTTFIRST') return 15;
	if (code === 'GOOSEFREE') return deliveryFee;
	return 0;
}

/** "ลด 10 ฿ + ฟรีค่าหิ้ว", plus the minimum when there is one */
export function describeBenefit(p: Pick<Promotion, 'discount' | 'freeDelivery' | 'minQty'>, withMinimum = true): string {
	const benefit = [p.discount > 0 ? `ลด ${p.discount} ฿` : '', p.freeDelivery ? 'ฟรีค่าหิ้ว' : ''].filter(Boolean).join(' + ');
	if (!withMinimum) return benefit;
	return p.minQty > 1 ? `${benefit} เมื่อสั่ง ${p.minQty} ชิ้นขึ้นไป` : `${benefit} ทุกออเดอร์`;
}

export interface AppliedPromotion {
	promotion: Promotion;
	/** Total baht this promotion saves: food discount plus a waived fee */
	saving: number;
}

/**
 * The single best live promotion for this cart. Promotions do not stack.
 * Mirrors the ORDER BY in supabase place_order(), which is the source of truth.
 */
export function bestPromotion(store: Store | null, items: CartItem[], deliveryFee: number): AppliedPromotion | null {
	if (!store) return null;
	const qty = items.reduce((sum, i) => sum + i.quantity, 0);
	let best: AppliedPromotion | null = null;
	for (const promotion of livePromotions(store)) {
		if (qty < promotion.minQty) continue;
		const saving = promotion.discount + (promotion.freeDelivery ? deliveryFee : 0);
		if (!best || saving > best.saving) best = { promotion, saving };
	}
	return best;
}

export function netTotal(parts: {
	foodTotal: number;
	deliveryFee: number;
	codeDiscount: number;
	partnerDiscount: number;
}): number {
	return Math.max(0, parts.foodTotal + parts.deliveryFee - parts.codeDiscount - parts.partnerDiscount);
}
