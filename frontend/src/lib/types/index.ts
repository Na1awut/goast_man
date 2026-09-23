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
	| 'PROFILE';

export type TabId = 'HOME' | 'ORDERS' | 'STORES' | 'CHAT' | 'PROFILE';

// --- User / Auth ---
export interface User {
	id: string;
	email: string;
	fullName: string;
	nickname: string;
	studentId: string;
	faculty: string;
	avatarUrl: string;
	phoneNumber: string;
	promptPayNo: string;
	role: 'STUDENT' | 'ADMIN';
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
export type StoreZone = 'canteen-male' | 'green-canteen' | 'dorm';

export interface PartnerDeal {
	/** Human-readable promo label shown on cards */
	label: string;
	/** Minimum number of items in cart before the deal applies */
	minQty: number;
	/** Flat baht discount off the food subtotal */
	amount: number;
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
	deal?: PartnerDeal;
	menuItems: MenuItem[];
}

export interface MenuItem {
	id: string;
	storeId: string;
	name: string;
	price: number;
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
