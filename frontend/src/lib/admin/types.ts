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
	/** The part of partner_discount the store gave (its own deal) */
	store_discount?: number;
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
	zone: string;
	/** Hidden from the app (being set up, or a retired mock-up) */
	hidden: boolean;
	/** The partner who runs it, or the email invited to; both null = team-run for now */
	owner_email: string | null;
	invite_email: string | null;
	orders_today: number;
	items_total: number;
	items_off: number;
}

/** Switches set from the console (QR test mode) */
export interface AppFlags {
	payment_test_mode: boolean;
	payment_test_since: string | null;
	payment_test_by: string | null;
	/** Rain fee: every delivery costs rain_fee more while it is on (STAFF or ADMIN switch it) */
	rain_surcharge?: boolean;
	rain_fee?: number;
	rain_since?: string | null;
	rain_by?: string | null;
}

/** An app discount code (ADMIN creates and switches it; STAFF can see the list) */
export interface AdminPromoCode {
	code: string;
	kind: 'AMOUNT' | 'FREE_DELIVERY';
	/** Baht off, for AMOUNT; null for FREE_DELIVERY */
	amount: number | null;
	/** When it starts working ("จะปล่อยโค้ดตอนไหน") */
	starts_at: string;
	max_uses: number;
	/** Orders placed with this code so far (cancelled ones don't count) */
	uses: number;
	active: boolean;
	created_at: string;
	created_by: string;
}

/** A new discount code, as the create form collects it */
export interface NewPromoCode {
	code: string;
	kind: 'AMOUNT' | 'FREE_DELIVERY';
	amount: number | null;
	/** ISO; null = starts now */
	startsAt: string | null;
	maxUses: number;
}

/** A deleted store waiting in the recycle bin (ADMIN) */
export interface TrashStore {
	id: string;
	name: string;
	category: string;
	lock: string;
	image_url: string;
	logo_url: string | null;
	deleted_at: string;
	deleted_by: string | null;
	/** When it is erased for good (60 days after deleting) */
	purge_at: string;
	owner_email: string | null;
	items_total: number;
	orders_total: number;
}

export interface NewStore {
	name: string;
	category: string;
	zone: string;
	lock: string;
	description: string;
	queueMinutes: number;
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
	/** Switched on as ready and seen in the last 10 minutes */
	online: boolean;
	last_seen: string | null;
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

export type ErrorStatus = 'open' | 'resolved';

/** One error from the web app, grouped: the same error seen again adds to count */
export interface ClientError {
	id: number;
	app: 'buyer' | 'console';
	kind: 'error' | 'rejection' | 'svelte';
	message: string;
	stack: string;
	source: string;
	url: string;
	user_agent: string;
	release: string;
	/** Last signed-in user who hit it */
	user: string | null;
	first_at: string;
	last_at: string;
	count: number;
	resolved_at: string | null;
	resolved_by: string | null;
}

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** A student's request to become a rider; an ADMIN approves after meeting them */
export interface RiderApplicationRow {
	id: string;
	email: string;
	availability: string;
	note: string | null;
	status: ApplicationStatus;
	review_note: string | null;
	created_at: string;
	reviewed_at: string | null;
	reviewed_by: string | null;
	nickname: string | null;
	full_name: string | null;
	student_id: string;
	phone: string;
	faculty: string;
	level: string | null;
	/** Orders they finished as a buyer: a hint of how they use the app */
	orders_as_buyer: number;
}

/** One chat message as the team reads it back (admin_order_chat) */
export interface ChatLogLine {
	id: number | string;
	at: string;
	role: 'CUSTOMER' | 'RIDER' | 'SYSTEM';
	by: string;
	body: string | null;
	image_path: string | null;
	/** Signed link to the photo, filled in by the API */
	image_url?: string;
}

export interface Badges {
	errors: number;
	rider_applications: number;
}
