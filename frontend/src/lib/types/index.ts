// ============================================================
// Goose Man (ห่านบางมด) — Shared TypeScript Types
// KMUTT Campus P2P Delivery Platform
// ============================================================

// --- User / Auth ---
export interface User {
	id: string;
	email: string;
	fullName: string;
	studentId: string;
	avatarUrl: string;
	phoneNumber: string;
	promptPayNo: string;
	role: 'STUDENT' | 'ADMIN';
	status: 'ACTIVE' | 'SUSPENDED';
	riderRatingAvg: number;
	createdAt: string;
}

// --- Location ---
export type HubZone = 'CANTEEN' | 'ACADEMIC' | 'OFFICE' | 'DORM' | 'OFF_CAMPUS';

export interface LocationHub {
	id: string;
	name: string;
	code: string;
	building: string;
	floor: string;
	zone: HubZone;
	hubType: 'PICKUP' | 'DROPOFF';
	description: string;
	isActive: boolean;
	stores?: Store[];
}

// --- Store & Menu ---
export interface Store {
	id: string;
	locationId: string;
	name: string;
	category: string;
	description: string;
	imageUrl: string;
	isOpen: boolean;
	rating?: number;
	reviewsCount?: string;
	queueStatus?: string;
	dealText?: string;
	menuItems?: MenuItem[];
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
	category?: string;
}

// --- Cart ---
export interface CartItem {
	menuItem: MenuItem;
	quantity: number;
	note?: string;
}

// --- Order ---
export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED';

export interface Order {
	id: string;
	orderCode: string;
	customerId: string;
	customerEmail: string;
	riderId?: string;
	riderEmail?: string;
	riderName?: string;
	riderFaculty?: string;
	riderRating?: number;
	riderPhone?: string;
	pickupHubId: string;
	pickupHubName: string;
	dropoffNodeId: string;
	dropoffNodeName: string;
	itemDetails: string;
	estimatedPrice: number;
	deliveryFee: number;
	discount?: number;
	totalPrice: number;
	status: OrderStatus;
	otpCode: string;
	note?: string;
	createdAt: string;
	updatedAt?: string;
	acceptedAt?: string;
	deliveringAt?: string;
	completedAt?: string;
}

// --- Chat ---
export interface ChatMessage {
	id: string;
	sender: 'RIDER' | 'CUSTOMER' | 'SYSTEM';
	text: string;
	time: string;
	imageUrl?: string;
}

// --- Wallet ---
export interface UserWallet {
	id: string;
	userId: string;
	balance: number;
	totalEarnings: number;
	completedJobsCount: number;
}

// --- Zone labels for display ---
export const ZONE_LABELS: Record<HubZone, string> = {
	CANTEEN: 'โรงอาหาร',
	ACADEMIC: 'อาคารเรียน',
	OFFICE: 'อาคารสำนักงาน',
	DORM: 'หอพักนักศึกษา',
	OFF_CAMPUS: 'นอกมอ / รอบมอ'
};
