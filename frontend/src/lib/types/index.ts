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
	| 'RIDER'
	| 'RIDER_EARNINGS'
	| 'RIDER_APPLY';

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
export type StoreZone = 'kfc-main' | 'female-dorm' | 'canteen-male' | 'green-canteen' | 'dorm';

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
	/** Hidden from the app by the team (being set up, or retired) */
	hidden?: boolean;
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
	/** PromptPay: when the slip was verified. Unset = riders do not see the order yet */
	paidAt?: string;
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
	/** Round-up tip for the rider, already inside totalPrice */
	tip?: number;
	/** The store's own deal: the stall charges this much less */
	storeDiscount?: number;
	note?: string;
	createdAt: string;
	acceptedAt?: string;
	customer?: { nickname: string; phone: string };
}

/** A job the rider finished, and what the team owes them for it */
export interface RiderEarning {
	id: string;
	orderCode: string;
	completedAt: string;
	pickupName: string;
	dropoffName: string;
	paymentMethod: PaymentMethod;
	foodTotal: number;
	deliveryFee: number;
	totalPrice: number;
	/** Round-up tip the buyer paid with the order */
	tip: number;
	/** The store's own deal, taken off at the counter */
	storeDiscount: number;
	/** The team's transfer for this job; 0 when the cash taken at the door already covered it */
	owed: number;
	/** When the team recorded the transfer, and its bank reference */
	paidOutAt?: string;
	payoutRef?: string;
}

/** A store's own numbers, for its owner (sales at menu price, completed orders) */
export interface PartnerDashboard {
	storeId: string;
	isOpen: boolean;
	today: { sales: number; orders: number; items: number; discounts: number; cancelled: number; onTheWay: number };
	month: { sales: number; orders: number };
	/** One entry per Bangkok day, oldest first, ending today */
	days: { day: string; sales: number; orders: number }[];
	topItems: { name: string; qty: number; sales: number }[];
	/** Orders the stall should expect: waiting for a rider, or a rider is coming */
	live: { id: string; code: string; status: OrderStatus; createdAt: string; acceptedAt?: string; note?: string; foodTotal: number; rider: string | null; items: { name: string; quantity: number }[] }[];
	recent: { id: string; code: string; completedAt: string; foodTotal: number; partnerDiscount: number; items: string }[];
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
