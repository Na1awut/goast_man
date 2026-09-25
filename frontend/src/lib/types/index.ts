// ============================================================
// Goose Man (ห่านบางมด) — Shared TypeScript Types
// KMUTT Campus P2P Delivery Platform
// ============================================================

// --- Navigation ---
export type Screen =
	| 'LOGIN'
	| 'HOME'
	| 'STORES'
	| 'STORE_DETAIL'
	| 'CUSTOM_ORDER'
	| 'CHECKOUT'
	| 'PAYMENT'
	| 'TRACKING'
	| 'CHAT'
	| 'SUCCESS'
	| 'ORDERS'
	| 'PROFILE'
	| 'PARTNER'
	| 'ONBOARDING'
	| 'EDIT_PROFILE'
	| 'RIDER';

export type TabId = 'HOME' | 'ORDERS' | 'STORES' | 'CHAT' | 'PROFILE';

// --- User / Auth ---
export interface User {
	id: string;
	email: string;
	fullName: string;
	nickname: string;
	studentId: string;
	faculty: string;
	/** '1'..'8', 'grad' or 'staff' */
	studyLevel?: string;
	/** Terms version the user accepted, and when */
	termsVersion?: string;
	consentedAt?: string;
	avatarUrl: string;
	phoneNumber: string;
	promptPayNo: string;
	role: 'STUDENT' | 'PARTNER' | 'ADMIN';
	/** On the rider roster: may run errands (โหมดคนหิ้ว) */
	isRider?: boolean;
	/** Set for PARTNER accounts: the store this account manages */
	partnerStoreId?: string;
	status: 'ACTIVE' | 'SUSPENDED';
	buyerRatingAvg: number;
	createdAt: string;
}

// --- Location ---
export type HubZone = 'CANTEEN' | 'ACADEMIC' | 'OFFICE' | 'DORM' | 'OFF_CAMPUS';

export interface DropoffPoint {
	id: string;
	name: string;
	shortName: string;
	note: string;
	zone: HubZone;
}

export interface PickupHub {
	id: string;
	name: string;
	shortName: string;
	icon: 'store' | 'cart' | 'utensils';
	zone: HubZone;
}

// --- Store & Menu ---
export type StoreZone = 'kfc-main' | 'canteen-male' | 'green-canteen' | 'dorm';

/**
 * DEAL     = the store's own promotion, live as soon as it is saved.
 * CO_PROMO = a joint promotion with Goose Man; live only once approved.
 */
export type PromoKind = 'DEAL' | 'CO_PROMO';

export interface Promotion {
	id: string;
	storeId: string;
	kind: PromoKind;
	title: string;
	description: string;
	/** Items needed in the cart before it applies */
	minQty: number;
	/** Baht off the food subtotal */
	discount: number;
	/** Waives the delivery fee */
	freeDelivery: boolean;
	bannerUrl?: string;
	endsAt?: string;
	active: boolean;
	approved: boolean;
}

export interface Store {
	id: string;
	zone: StoreZone;
	name: string;
	category: string;
	description: string;
	imageUrl: string;
	isOpen: boolean;
	rating: number;
	reviewsCount: string;
	queueMinutes: number;
	lock: string;
	/** Partner stores get a verified badge, list priority, a storefront and promotions */
	isPartner: boolean;
	/** Storefront banner set by the partner (falls back to imageUrl) */
	bannerUrl?: string;
	/** Store logo set by the partner; screens fall back to the name's first letter */
	logoUrl?: string;
	tagline?: string;
	/** Prep time for app orders at a partner's fast lane */
	fastLaneMinutes?: number;
	promotions: Promotion[];
	menuItems: MenuItem[];
}

export interface MenuItem {
	id: string;
	storeId: string;
	name: string;
	price: number;
	/** Price of the พิเศษ (larger) size, for items the stall sells in two sizes */
	specialPrice?: number;
	originalPrice?: number;
	description: string;
	imageUrl: string;
	isAvailable: boolean;
	isPopular?: boolean;
	category: string;
}

// --- Cart ---
export interface CartItem {
	menuItem: MenuItem;
	quantity: number;
	/** พิเศษ size; only for items with a specialPrice */
	special?: boolean;
}

// --- Rider ---
export interface Rider {
	id: string;
	name: string;
	fullName: string;
	faculty: string;
	rating: number;
	jobs: number;
	phone: string;
}

// --- Order ---
export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED';
export type PaymentMethod = 'PROMPTPAY' | 'CASH';
export type OrderKind = 'STORE' | 'CUSTOM';

export interface Order {
	id: string;
	orderCode: string;
	kind: OrderKind;
	customerId: string;
	storeId?: string;
	rider?: Rider;
	pickupName: string;
	dropoffName: string;
	itemDetails: string;
	items?: CartItem[];
	foodTotal: number;
	deliveryFee: number;
	codeDiscount: number;
	partnerDiscount: number;
	promoCode?: string;
	totalPrice: number;
	paymentMethod: PaymentMethod;
	status: OrderStatus;
	otpCode: string;
	note?: string;
	createdAt: string;
	acceptedAt?: string;
	deliveringAt?: string;
	completedAt?: string;
	rating?: number;
	feedbackTags?: string[];
	tip?: number;
}

// --- Rider (คนหิ้ว) ---
/** A job as the rider sees it. Customer contact is only present once the rider holds the job. */
export interface RiderJob {
	id: string;
	orderCode: string;
	kind: OrderKind;
	storeId?: string;
	pickupName: string;
	dropoffName: string;
	itemDetails: string;
	items: { name: string; price: number; quantity: number }[];
	foodTotal: number;
	deliveryFee: number;
	totalPrice: number;
	paymentMethod: PaymentMethod;
	status: OrderStatus;
	note?: string;
	createdAt: string;
	acceptedAt?: string;
	customer?: { nickname: string; phone: string };
}

// --- Chat ---
export interface ChatMessage {
	id: string;
	sender: 'RIDER' | 'CUSTOMER' | 'SYSTEM';
	text: string;
	time: string;
	imageUrl?: string;
}

// --- Notifications ---
export interface AppNotification {
	id: string;
	text: string;
	time: string;
	read: boolean;
}
