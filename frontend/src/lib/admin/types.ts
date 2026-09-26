// Shapes returned by the admin_* database functions (supabase/migrations/20261001000000_team_console.sql)

export type TeamRole = 'ADMIN' | 'STAFF';
export type Stage = 'AWAITING_PAYMENT' | 'PENDING' | 'ACCEPTED' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED';
export type AttentionCode = 'OTP_LOCKED' | 'REFUND_DUE' | 'LATE' | 'UNASSIGNED' | 'UNPAID';
export type OrdersTab = 'attention' | 'active' | 'awaiting_payment' | 'done' | 'cancelled' | 'all';
export type Payment = 'CASH' | 'PROMPTPAY';

export interface TeamMe {
	email: string;
	role: TeamRole;
	nickname: string;
	full_name: string;
}

export interface Attention {
	code: AttentionCode;
	rank: number;
	minutes?: number;
	amount?: number;
}

export interface OrderRow {
	id: string;
	code: string;
	kind: 'STORE' | 'CUSTOM';
	stage: Stage;
	status: Exclude<Stage, 'AWAITING_PAYMENT'>;
	created_at: string;
	store_id: string | null;
	pickup: string;
	dropoff: string;
	total: number;
	payment: Payment;
	paid_at: string | null;
	customer: string | null;
	rider: string | null;
	attention: Attention[];
}

export interface OrdersPage {
	rows: OrderRow[];
	total: number;
	counts: Record<OrdersTab, number>;
}

export interface Person {
	nickname: string;
	full_name: string;
	phone: string;
	faculty: string;
	level: string;
	promptpay?: string;
	holding?: number;
}

export interface ActivityEntry {
	at: string;
	by: string;
	action: string;
	detail: Record<string, unknown>;
}

export interface OrderDetail extends OrderRow {
	note: string | null;
	food_total: number;
	delivery_fee: number;
	code_discount: number;
	partner_discount: number;
	promo_code: string | null;
	slip_ref: string | null;
	accepted_at: string | null;
	delivering_at: string | null;
	completed_at: string | null;
	cancelled_at: string | null;
	cancel_reason: string | null;
	cancelled_by: string | null;
	payment_confirmed_by: string | null;
	refunded_at: string | null;
	refund_ref: string | null;
	payout_paid_at: string | null;
	rating: number | null;
	tip: number;
	otp_failed: number;
	store: { id: string; name: string; lock: string; image_url: string } | null;
	items: { name: string; price: number; quantity: number }[];
	customer_info: Person | null;
	rider_info: Person | null;
	activity: ActivityEntry[];
}

export interface Slot {
	at: string;
	orders: number;
	gmv: number;
}

export interface Overview {
	day: string;
	is_today: boolean;
	orders: number;
	gmv: number;
	food: number;
	fees: number;
	waiting_rider: number;
	awaiting_payment: number;
	delivering: number;
	stores_open: number;
	stores_total: number;
	riders_busy: number;
	riders_total: number;
	refunds_due: number;
	refunds_due_amount: number;
	rider_cost_day: number;
	payouts_due: number;
	payouts_due_riders: number;
	avg_accept_minutes: number | null;
	problems: number;
	pending_promos: number;
	slots: Slot[];
	status_counts: Record<Stage, number>;
	top_stores: { id: string; name: string; orders: number; gmv: number }[];
	riders: {
		id: string | null;
		nickname: string;
		job_code: string | null;
		job_pickup: string | null;
		job_dropoff: string | null;
		job_status: 'ACCEPTED' | 'DELIVERING' | null;
		holding: number;
		busy: boolean;
	}[];
}

export interface PayoutOrder {
	order_id: string;
	code: string;
	completed_at: string;
	payment: Payment;
	food: number;
	fee: number;
	cash: number;
	owed: number;
}

export interface RiderPayout {
	rider_id: string;
	name: string;
	email: string;
	promptpay: string;
	faculty: string;
	level: string;
	owed: number;
	jobs: number;
	oldest: string;
	orders: PayoutOrder[];
}

export interface RefundDue {
	order_id: string;
	code: string;
	amount: number;
	cancelled_at: string;
	reason: string | null;
	cancelled_by: string | null;
	customer: string;
	phone: string;
	promptpay: string;
}

export interface MoneyEntry {
	kind: 'PAYOUT' | 'REFUND';
	at: string;
	recipient: string;
	amount: number;
	jobs: number;
	ref: string | null;
	by: string | null;
}

export interface AdminStore {
	id: string;
	name: string;
	category: string;
	lock: string;
	image_url: string;
	logo_url: string | null;
	is_open: boolean;
	is_partner: boolean;
	orders_today: number;
	items_total: number;
	items_off: number;
}

export interface AdminMenuItem {
	id: string;
	name: string;
	price: number;
	special_price: number | null;
	category: string;
	is_available: boolean;
}

export interface AdminRider {
	email: string;
	note: string | null;
	added_at: string;
	added_by: string | null;
	user_id: string | null;
	nickname: string | null;
	full_name: string | null;
	phone: string;
	faculty: string;
	level: string | null;
	holding: number;
	delivering: boolean;
	busy: boolean;
	jobs_today: number;
	jobs_total: number;
	rating: number | null;
}

export type PromoState = 'PENDING' | 'LIVE' | 'OFF' | 'REJECTED' | 'ENDED';

export interface AdminPromo {
	id: string;
	store_id: string;
	store: string;
	store_image: string;
	kind: 'DEAL' | 'CO_PROMO';
	title: string;
	description: string;
	min_qty: number;
	discount: number;
	free_delivery: boolean;
	ends_at: string | null;
	active: boolean;
	approved: boolean;
	created_at: string;
	review_note: string | null;
	state: PromoState;
	uses: number;
}

export interface Partners {
	partners: { store_id: string; store: string; owner_email: string; owner_name: string; joined_at: string }[];
	invites: { email: string; store_id: string; store: string; invited_at: string }[];
}

export interface TeamMember {
	email: string;
	role: TeamRole;
	note: string | null;
	added_at: string;
	added_by: string | null;
	name: string | null;
	full_name: string | null;
	has_account: boolean;
	is_me: boolean;
}

export interface LogEntry {
	id: number;
	at: string;
	by: string;
	action: string;
	target_type: string;
	target_id: string;
	target: string;
	detail: Record<string, unknown>;
}
