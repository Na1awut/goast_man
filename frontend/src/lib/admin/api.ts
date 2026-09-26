// Everything the team console asks of the database. Live mode calls the
// admin_* functions (each checks the caller's team role); demo mode runs the
// same interface on sample data in memory (./demo.ts).
import { db, friendlyError, isLive } from '$lib/supabase';
import { ADMIN_ERRORS } from './labels';
import type {
	AdminMenuItem,
	AdminPromo,
	AdminRider,
	AdminStore,
	LogEntry,
	MoneyEntry,
	OrderDetail,
	OrdersPage,
	OrdersTab,
	Overview,
	Partners,
	Payment,
	RefundDue,
	RiderPayout,
	TeamMe,
	TeamMember,
	TeamRole
} from './types';

export interface OrderQuery {
	tab: OrdersTab;
	day?: string;
	store?: string | null;
	payment?: Payment | null;
	search?: string;
	limit?: number;
	offset?: number;
}

export interface AdminApi {
	me(): Promise<TeamMe | null>;
	overview(day?: string): Promise<Overview>;
	orders(q: OrderQuery): Promise<OrdersPage>;
	order(id: string): Promise<OrderDetail>;
	cancelOrder(id: string, reason: string): Promise<void>;
	confirmPayment(id: string, bankRef: string): Promise<void>;
	unlockOtp(id: string): Promise<void>;
	requeueOrder(id: string, reason: string): Promise<void>;
	markRefunded(id: string, ref: string): Promise<void>;
	payouts(): Promise<RiderPayout[]>;
	markPayout(riderId: string, orderIds: string[], ref: string): Promise<{ amount: number }>;
	refundsDue(): Promise<RefundDue[]>;
	moneyHistory(from?: string, to?: string): Promise<MoneyEntry[]>;
	stores(): Promise<AdminStore[]>;
	storeMenu(storeId: string): Promise<AdminMenuItem[]>;
	setStoreOpen(storeId: string, open: boolean): Promise<void>;
	setItemAvailable(itemId: string, available: boolean): Promise<void>;
	riders(): Promise<AdminRider[]>;
	addRider(email: string, note: string): Promise<void>;
	removeRider(email: string, reason: string): Promise<void>;
	promotions(): Promise<AdminPromo[]>;
	reviewPromo(id: string, approve: boolean, note: string): Promise<void>;
	setPromoActive(id: string, active: boolean): Promise<void>;
	partners(): Promise<Partners>;
	invitePartner(email: string, storeId: string): Promise<void>;
	cancelInvite(email: string): Promise<void>;
	team(): Promise<TeamMember[]>;
	setMember(email: string, role: TeamRole, note?: string): Promise<void>;
	removeMember(email: string): Promise<void>;
	activity(limit?: number, before?: string): Promise<LogEntry[]>;
}

/** A database error code or message, in the team's words */
export function adminError(err: unknown): string {
	const text = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String(err.message) : String(err);
	const code = Object.keys(ADMIN_ERRORS).find((k) => text.includes(k));
	return code ? ADMIN_ERRORS[code] : friendlyError(err);
}

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
	const { data, error } = await db().rpc(fn, args);
	if (error) throw new Error(error.message);
	return data as T;
}

const liveApi: AdminApi = {
	me: () => call('team_me'),
	overview: (day) => call('admin_overview', { p_day: day ?? null }),
	orders: (q) =>
		call('admin_orders', {
			p_tab: q.tab,
			p_day: q.day ?? null,
			p_store: q.store ?? null,
			p_payment: q.payment ?? null,
			p_search: q.search?.trim() || null,
			p_limit: q.limit ?? 50,
			p_offset: q.offset ?? 0
		}),
	order: (id) => call('admin_order', { p_order_id: id }),
	cancelOrder: (id, reason) => call('admin_cancel_order', { p_order_id: id, p_reason: reason }),
	confirmPayment: (id, bankRef) => call('admin_confirm_payment', { p_order_id: id, p_bank_ref: bankRef }),
	unlockOtp: (id) => call('admin_unlock_otp', { p_order_id: id }),
	requeueOrder: (id, reason) => call('admin_requeue_order', { p_order_id: id, p_reason: reason }),
	markRefunded: (id, ref) => call('admin_mark_refunded', { p_order_id: id, p_ref: ref }),
	payouts: () => call('admin_payouts'),
	markPayout: (riderId, orderIds, ref) => call('admin_mark_payout', { p_rider_id: riderId, p_order_ids: orderIds, p_ref: ref }),
	refundsDue: () => call('admin_refunds_due'),
	moneyHistory: (from, to) => call('admin_money_history', { p_from: from ?? null, p_to: to ?? null }),
	stores: () => call('admin_stores'),
	storeMenu: (storeId) => call('admin_store_menu', { p_store_id: storeId }),
	setStoreOpen: (storeId, open) => call('admin_set_store_open', { p_store_id: storeId, p_open: open }),
	setItemAvailable: (itemId, available) => call('admin_set_item_available', { p_item_id: itemId, p_available: available }),
	riders: () => call('admin_riders'),
	addRider: (email, note) => call('admin_add_rider', { p_email: email, p_note: note }),
	removeRider: (email, reason) => call('admin_remove_rider', { p_email: email, p_reason: reason }),
	promotions: () => call('admin_promotions'),
	reviewPromo: (id, approve, note) => call('admin_review_promo', { p_promo_id: id, p_approve: approve, p_note: note }),
	setPromoActive: (id, active) => call('admin_set_promo_active', { p_promo_id: id, p_active: active }),
	partners: () => call('admin_partners'),
	invitePartner: (email, storeId) => call('admin_invite_partner', { p_email: email, p_store_id: storeId }),
	cancelInvite: (email) => call('admin_cancel_invite', { p_email: email }),
	team: () => call('admin_team'),
	setMember: (email, role, note) => call('admin_set_member', { p_email: email, p_role: role, p_note: note ?? null }),
	removeMember: (email) => call('admin_remove_member', { p_email: email }),
	activity: (limit, before) => call('admin_activity', { p_limit: limit ?? 100, p_before: before ?? null })
};

let demo: import('./demo').DemoApi | null = null;

/** The live API, or the demo one when Supabase is not configured */
export async function adminApi(): Promise<AdminApi> {
	if (isLive) return liveApi;
	demo ??= (await import('./demo')).createDemoApi();
	return demo;
}

/** Demo mode only: switch the sample account between ADMIN and STAFF */
export function demoSetRole(role: TeamRole) {
	demo?.demoSetRole(role);
}
