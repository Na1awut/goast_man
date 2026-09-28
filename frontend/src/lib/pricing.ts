// Pure pricing rules — kept free of UI state so they can be unit-tested
// and mirrored on the backend.
import type { CartItem, Promotion, Store } from '$lib/types';
import { livePromotions } from '$lib/data/stores';

export const STORE_DELIVERY_FEE = 15;
export const CUSTOM_DELIVERY_FEE = 20;

// Delivery fee (mirrors delivery_quote() in the database, which decides):
// 15 ฿ within FEE_NEAR_M of the store's canteen, 20 ฿ beyond (ฝากซื้อ: 20),
// +1 ฿ per floor above the first, base + floors never above FEE_CAP,
// +RAIN_FEE while the team has the rain fee on.
export const FEE_NEAR_M = 300;
export const FEE_CAP = 25;
export const RAIN_FEE = 5;
export const MAX_FLOOR = 20;
/** What one rider can carry: items per order, quantities added up */
export const MAX_ORDER_ITEMS = 5;

export interface DeliveryQuote {
	base: number;
	floorFee: number;
	rain: number;
	fee: number;
	near: boolean;
}

/** distanceM null = ฝากซื้อ (no store): the 20 ฿ base */
export function quoteDelivery(a: { distanceM: number | null; floor: number; raining: boolean }): DeliveryQuote {
	const near = a.distanceM !== null && a.distanceM <= FEE_NEAR_M;
	const base = near ? STORE_DELIVERY_FEE : CUSTOM_DELIVERY_FEE;
	const floorFee = Math.max(0, Math.min(Math.floor(a.floor) - 1, FEE_CAP - base));
	const rain = a.raining ? RAIN_FEE : 0;
	return { base, floorFee, rain, fee: base + floorFee + rain, near };
}

/** "15 ฿ ใกล้โรงอาหาร · ชั้น 5 +4 ฿ · ฝนตก +5 ฿" */
export function describeQuote(q: DeliveryQuote, floor: number, custom = false): string {
	const parts = [custom ? `ฝากซื้อ ${q.base} ฿` : `${q.base} ฿ ${q.near ? 'ใกล้โรงอาหาร' : 'ไกลจากโรงอาหาร'}`];
	if (q.floorFee) parts.push(`ชั้น ${floor} +${q.floorFee} ฿`);
	if (q.rain) parts.push(`ฝนตก +${q.rain} ฿`);
	return parts.join(' · ');
}
/** Upper bound for a custom order: the runner fronts this money in cash */
export const CUSTOM_MAX_PRICE = 1000;

// App discount codes: created by ADMIN from the console (หน้า "โค้ดส่วนลด"), not
// hardcoded. A code is either a flat baht AMOUNT off, or FREE_DELIVERY (waives the
// fee). The app only ever learns a code's effect by asking the database
// (check_promo_code / place_order_at); this type is just the shape of that answer.
export type CodeKind = 'AMOUNT' | 'FREE_DELIVERY';

export interface AppliedCode {
	code: string;
	kind: CodeKind;
	/** Baht off, for AMOUNT; null for FREE_DELIVERY */
	amount: number | null;
}

/** Price of one unit of a cart line: the พิเศษ size when chosen and offered */
export function unitPrice(line: Pick<CartItem, 'menuItem' | 'special'>): number {
	return line.special && line.menuItem.specialPrice ? line.menuItem.specialPrice : line.menuItem.price;
}

/** Display name of a cart line, with the size when it is พิเศษ */
export function lineName(line: Pick<CartItem, 'menuItem' | 'special'>): string {
	return line.special && line.menuItem.specialPrice ? `${line.menuItem.name} (พิเศษ)` : line.menuItem.name;
}

/** `deliveryFee` is the fee still payable after any partner free-delivery promotion */
export function promoDiscount(applied: AppliedCode | null, deliveryFee: number): number {
	if (!applied) return 0;
	return applied.kind === 'FREE_DELIVERY' ? deliveryFee : (applied.amount ?? 0);
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

/**
 * Round-up tip offered at checkout: the baht that bring the total to the next
 * multiple of 5 (52 → 3, 58 → 2, 55 → 0). Mirrors round_up_tip() in the database,
 * which accepts no other tip.
 */
export function roundUpTip(total: number): number {
	return (5 - (total % 5)) % 5;
}
