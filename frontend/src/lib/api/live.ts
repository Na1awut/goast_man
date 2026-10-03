// Every Supabase call the app makes lives here, so stores stay mode-agnostic and
// the row ↔ type mapping has exactly one home. Only imported on live paths.
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { CartItem, ChatMessage, HomeBanner, MenuItem, MenuOptionGroup, OperatingHours, Order, OrderStatus, PaymentMethod, PartnerDashboard, Promotion, StoreOpenStatus, Rider, RiderEarning, RiderJob, SelectedOptionChoice, Store, User } from '$lib/types';
import { owedToRider } from '$lib/admin/rules';
import { base } from '$app/paths';
import { verifySlipUrl } from '$lib/payments';
import { isTestSite } from '$lib/sim';
import { db } from '$lib/supabase';
import { formatTime } from '$lib/utils';
import { fileToDataUrl } from '$lib/image';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// ---------- Mappers ----------

function mapPromotion(r: Row): Promotion {
	return {
		id: r.id,
		storeId: r.store_id,
		kind: r.kind,
		title: r.title,
		description: r.description ?? '',
		minQty: r.min_qty,
		discount: r.discount,
		freeDelivery: r.free_delivery,
		bannerUrl: r.banner_url ?? undefined,
		endsAt: r.ends_at ?? undefined,
		active: r.active,
		approved: r.approved
	};
}

function mapMenuItem(r: Row): MenuItem {
	return {
		id: r.id,
		storeId: r.store_id,
		name: r.name,
		price: r.price,
		specialPrice: r.special_price ?? undefined,
		originalPrice: r.original_price ?? undefined,
		description: r.description ?? '',
		imageUrl: r.image_url ?? '',
		isAvailable: r.is_available,
		isPopular: r.is_popular,
		category: r.category ?? '',
		options: Array.isArray(r.options) ? r.options : []
	};
}

function mapStore(r: Row): Store {
	return {
		id: r.id,
		zone: r.zone,
		name: r.name,
		category: r.category,
		description: r.description ?? '',
		imageUrl: r.image_url ?? '',
		isOpen: r.is_open,
		operatingHours: r.operating_hours ?? undefined,
		hidden: r.hidden ?? false,
		rating: Number(r.rating),
		reviewsCount: r.reviews_count,
		queueMinutes: r.queue_minutes,
		lock: r.lock ?? '',
		isPartner: r.is_partner,
		bannerUrl: r.banner_url ?? undefined,
		logoUrl: r.logo_url ?? undefined,
		tagline: r.tagline ?? undefined,
		fastLaneMinutes: r.fast_lane_minutes ?? undefined,
		promotions: ((r.promotions ?? []) as Row[])
			.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
			.map(mapPromotion),
		menuItems: ((r.menu_items ?? []) as Row[]).sort((a, b) => a.sort - b.sort).map(mapMenuItem)
	};
}

function mapProfile(r: Row): User {
	return {
		id: r.id,
		email: r.email,
		fullName: r.full_name || r.email,
		nickname: r.nickname || (r.full_name as string)?.split(' ')[0] || r.email.split('@')[0],
		studentId: r.student_id ?? '',
		faculty: r.faculty ?? '',
		studyLevel: r.study_level ?? undefined,
		termsVersion: r.terms_version ?? undefined,
		consentedAt: r.consented_at ?? undefined,
		avatarUrl: '',
		phoneNumber: r.phone ?? '',
		promptPayNo: r.promptpay_no ?? '',
		role: r.role,
		partnerStoreId: r.partner_store_id ?? undefined,
		status: 'ACTIVE',
		buyerRatingAvg: 5,
		createdAt: r.created_at
	};
}

function mapRider(r: Row | null): Rider | undefined {
	if (!r) return undefined;
	return {
		id: r.id,
		name: r.name || r.full_name,
		fullName: r.full_name,
		faculty: r.faculty,
		rating: Number(r.rating),
		jobs: Number(r.jobs)
	};
}

/** Order JSON from my_orders(); line items resolve against the catalogue when possible */
function mapOrder(r: Row, findItem: (id: string) => MenuItem | undefined): Order {
	const items: CartItem[] | undefined = (r.items as Row[] | null)?.map((i) => ({
		quantity: i.quantity,
		special: !!i.special,
		selectedOptions: Array.isArray(i.selected_options) ? i.selected_options : [],
		menuItem: findItem(i.menu_item_id) ?? {
			id: i.menu_item_id,
			storeId: r.store_id,
			name: i.name,
			price: i.price,
			description: '',
			imageUrl: '',
			isAvailable: false,
			category: ''
		}
	}));
	return {
		id: r.id,
		orderCode: r.order_code,
		kind: r.kind,
		customerId: r.customer_id,
		storeId: r.store_id ?? undefined,
		rider: mapRider(r.rider),
		pickupName: r.pickup_name,
		dropoffName: r.dropoff_name,
		itemDetails: r.item_details,
		items,
		foodTotal: r.food_total,
		deliveryFee: r.delivery_fee,
		codeDiscount: r.code_discount,
		partnerDiscount: r.partner_discount,
		promoCode: r.promo_code ?? undefined,
		totalPrice: r.total_price,
		paymentMethod: r.payment_method,
		paidAt: r.paid_at ?? undefined,
		status: r.status,
		otpCode: r.otp_code ?? '',
		note: r.note ?? undefined,
		createdAt: r.created_at,
		acceptedAt: r.accepted_at ?? undefined,
		deliveringAt: r.delivering_at ?? undefined,
		completedAt: r.completed_at ?? undefined,
		rating: r.rating ?? undefined,
		feedbackTags: r.feedback_tags ?? [],
		tip: r.tip ?? 0
	};
}

function mapChat(r: Row, imageUrl?: string): ChatMessage {
	return { id: r.id, sender: r.sender_role, text: r.body ?? '', time: formatTime(r.created_at), imageUrl };
}

function check<T>({ data, error }: { data: T; error: unknown }): T {
	if (error) throw error;
	return data;
}

// ---------- Auth & profile ----------

export async function currentUser(): Promise<User | null> {
	const { data } = await db().auth.getSession();
	const uid = data.session?.user.id;
	if (!uid) return null;
	const profile = check(await db().from('profiles').select('*').eq('id', uid).maybeSingle());
	if (!profile) return null;
	const isRider = check(await db().rpc('is_rider')) as boolean;
	return { ...mapProfile(profile), isRider };
}

/**
 * Redirects to Google's account chooser, listing every account already signed in
 * on the device. No hosted-domain (hd) hint: KMUTT uses two Google domains
 * (@kmutt.ac.th and @mail.kmutt.ac.th) and hd accepts only one, so a hint hid
 * students' accounts and sent them to a blank sign-in form. The database trigger
 * rejects anything but KMUTT accounts and invited partner shops.
 */
/**
 * Real console only: asks for a 60-second ticket that lets this signed-in team member open the test site as the
 * given test role. The server checks they are on the team; the ticket is for the test site's /enter/ page.
 */
export async function requestTestTicket(role: string): Promise<{ ticket: string; url: string }> {
	const { data, error } = await db().functions.invoke('test-ticket', { body: { role } });
	if (error || !data?.ticket || !data?.url) throw error ?? new Error(String(data?.error ?? 'TICKET_FAILED'));
	return { ticket: data.ticket, url: data.url };
}

/** Test site only (see lib/sim.ts): trades a ticket from the real console for a signed-in session. Refused everywhere else. */
export async function enterTestSite(ticket: string): Promise<'/' | '/admin/'> {
	if (!isTestSite) throw new Error('TEST_SITE_ONLY');
	const { data, error } = await db().functions.invoke('test-login', { body: { ticket } });
	if (error || !data?.token_hash) throw error ?? new Error(String(data?.error ?? 'BAD_TICKET'));
	const verified = await db().auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
	if (verified.error) throw verified.error;
	return data.next === '/admin/' ? '/admin/' : '/';
}

export async function signInWithGoogle(asPartner: boolean): Promise<void> {
	const { error } = await db().auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo: window.location.origin + base + '/',
			queryParams: { prompt: 'select_account' }
		}
	});
	if (error) throw error;
}

/**
 * Signs in with a Microsoft account (Office 365 / KMUTT student mail).
 */
export async function signInWithMicrosoft(asPartner: boolean = false): Promise<void> {
	const { error } = await db().auth.signInWithOAuth({
		provider: 'azure',
		options: {
			scopes: 'email profile offline_access openid',
			redirectTo: window.location.origin + base + '/',
			queryParams: { prompt: 'select_account' }
		}
	});
	if (error) throw error;
}

/**
 * Sends the transfer slip of a PromptPay order to the verify-slip Edge Function,
 * which checks it with SlipOK and marks the order paid. Throws the error code.
 */
export async function verifySlip(orderId: string, slip: File): Promise<void> {
	const {
		data: { session }
	} = await db().auth.getSession();
	if (!session) throw new Error('AUTH_REQUIRED');
	const body = new FormData();
	body.append('order_id', orderId);
	body.append('slip', slip);
	const res = await fetch(verifySlipUrl, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body });
	const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
	if (!res.ok || !out.ok) throw new Error(out.error ?? 'SLIPOK_UNAVAILABLE');
}

/** Switches the team sets from the console (QR test mode) */
export interface AppFlags {
	payment_test_mode: boolean;
	payment_test_since: string | null;
	payment_test_by: string | null;
	/** Rain fee (+rain_fee ฿) switched on by the team */
	rain_surcharge?: boolean;
	rain_fee?: number;
}
export async function fetchAppFlags(): Promise<AppFlags> {
	return check(await db().rpc('app_flags')) as AppFlags;
}

/** Test site only: marks the buyer's own unpaid PromptPay order paid, no transfer */
export async function payOrderTest(orderId: string): Promise<void> {
	if (!isTestSite) throw new Error('TEST_SITE_ONLY');
	check(await db().rpc('pay_order_test', { p_order_id: orderId }));
}

/** Previews a discount code's effect at checkout, without spending one of its uses (place_order_at does that for real) */
export async function checkPromoCode(code: string): Promise<{ code: string; kind: 'AMOUNT' | 'FREE_DELIVERY'; amount: number | null }> {
	const row = check(await db().rpc('check_promo_code', { p_code: code })) as Row;
	return { code: row.code, kind: row.kind, amount: row.amount ?? null };
}

export async function signOut(): Promise<void> {
	await db().auth.signOut();
}

/** Error the OAuth round trip left in the URL (e.g. KMUTT_ONLY from the sign-up trigger) */
export function takeAuthRedirectError(): string | null {
	const params = new URLSearchParams(window.location.search + window.location.hash.replace(/^#/, '&'));
	const message = params.get('error_description');
	if (!message) return null;
	history.replaceState(null, '', window.location.pathname);
	return message;
}

export interface CompleteProfileArgs {
	nickname: string;
	phone: string;
	promptPay: string;
	studentId: string;
	faculty: string;
	studyLevel: string;
	termsVersion: string;
}

/** Validates on the server and records PDPA consent; returns the saved profile */
export async function completeProfile(a: CompleteProfileArgs): Promise<User> {
	check(
		await db().rpc('complete_profile', {
			p_nickname: a.nickname,
			p_phone: a.phone,
			p_promptpay: a.promptPay,
			p_student_id: a.studentId,
			p_faculty: a.faculty,
			p_study_level: a.studyLevel,
			p_terms_version: a.termsVersion
		})
	);
	const user = await currentUser();
	if (!user) throw new Error('AUTH_REQUIRED');
	return user;
}

// ---------- Catalogue ----------

export async function fetchCatalog(): Promise<Store[]> {
	const rows = check(await db().from('stores').select('*, menu_items(*), promotions(*)'));
	return (rows ?? []).map(mapStore);
}

export async function fetchStore(storeId: string): Promise<Store> {
	const row = check(await db().from('stores').select('*, menu_items(*), promotions(*)').eq('id', storeId).maybeSingle());
	if (!row) throw new Error('STORE_NOT_FOUND');
	return mapStore(row);
}

// ---------- Orders ----------

export interface StoreOrderArgs {
	storeId: string;
	items: { menuItemId: string; quantity: number; special?: boolean; selectedOptions?: SelectedOptionChoice[] }[];
	/** Drop-off building and floor: the database works out the fee from them */
	dropoffId: string;
	floor: number;
	note?: string;
	paymentMethod: PaymentMethod;
	promoCode?: string;
	/** Round-up tip (0-4 baht); the database accepts only the round-up to the next 5 */
	tip?: number;
}

export async function placeStoreOrder(a: StoreOrderArgs): Promise<string> {
	return check(
		await db().rpc('place_order_at', {
			p_store_id: a.storeId,
			p_items: a.items.map((i) => ({
				menu_item_id: i.menuItemId,
				quantity: i.quantity,
				special: !!i.special,
				selected_options: i.selectedOptions ?? []
			})),
			p_dropoff_id: a.dropoffId,
			p_floor: a.floor,
			p_note: a.note ?? '',
			p_payment: a.paymentMethod,
			p_promo_code: a.promoCode ?? null,
			p_tip: a.tip ?? 0
		})
	) as string;
}

export async function placeCustomOrder(a: { pickupName: string; itemDetails: string; estimated: number; dropoffId: string; floor: number; note?: string }): Promise<string> {
	return check(
		await db().rpc('place_custom_order_at', {
			p_pickup: a.pickupName,
			p_items: a.itemDetails,
			p_estimated: a.estimated,
			p_dropoff_id: a.dropoffId,
			p_floor: a.floor,
			p_note: a.note ?? ''
		})
	) as string;
}

export async function fetchMyOrders(findItem: (id: string) => MenuItem | undefined, orderId?: string): Promise<Order[]> {
	const rows = check(await db().rpc('my_orders', { p_order_id: orderId ?? null })) as Row[];
	return (rows ?? []).map((r) => mapOrder(r, findItem));
}

export async function cancelOrder(orderId: string): Promise<void> {
	check(await db().rpc('cancel_order', { p_order_id: orderId }));
}

export async function rateOrder(orderId: string, rating: number, tags: string[]): Promise<void> {
	// p_tip is ignored by the database now (the tip is set at checkout); kept for the signature
	check(await db().rpc('rate_order', { p_order_id: orderId, p_rating: rating, p_tags: tags, p_tip: 0 }));
}

/** Calls `onChange(orderId, status)` whenever one of this customer's orders changes */
export function subscribeMyOrders(customerId: string, onChange: (orderId: string, status: OrderStatus) => void): () => void {
	const channel: RealtimeChannel = db()
		.channel(`orders:${customerId}`)
		.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${customerId}` }, (payload) =>
			onChange((payload.new as Row).id, (payload.new as Row).status)
		)
		.subscribe();
	return () => void db().removeChannel(channel);
}

// ---------- Chat ----------

async function signedImageUrls(rows: Row[]): Promise<Map<string, string>> {
	const paths = rows.map((r) => r.image_path).filter(Boolean) as string[];
	if (!paths.length) return new Map();
	const signed = check(await db().storage.from('chat-images').createSignedUrls(paths, 60 * 60)) ?? [];
	const pairs = signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as [string, string]] : []));
	return new Map(pairs);
}

export async function fetchChat(orderId: string): Promise<ChatMessage[]> {
	const rows = (check(await db().from('chat_messages').select('*').eq('order_id', orderId).order('created_at')) ?? []) as Row[];
	const urls = await signedImageUrls(rows);
	return rows.map((r) => mapChat(r, r.image_path ? urls.get(r.image_path) : undefined));
}

export async function sendChat(orderId: string, senderId: string, text: string, file?: File, role: 'CUSTOMER' | 'RIDER' = 'CUSTOMER'): Promise<ChatMessage> {
	let imagePath: string | null = null;
	if (file) {
		const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
		imagePath = `${orderId}/${crypto.randomUUID()}.${ext}`;
		check(await db().storage.from('chat-images').upload(imagePath, file, { contentType: file.type }));
	}
	const row = check(
		await db()
			.from('chat_messages')
			.insert({ order_id: orderId, sender_id: senderId, sender_role: role, body: text, image_path: imagePath })
			.select()
			.single()
	) as Row;
	const urls = await signedImageUrls([row]);
	return mapChat(row, imagePath ? urls.get(imagePath) : undefined);
}

export function subscribeChat(orderId: string, onMessage: (message: ChatMessage) => void): () => void {
	const channel = db()
		.channel(`chat:${orderId}`)
		.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `order_id=eq.${orderId}` }, async (payload) => {
			const row = payload.new as Row;
			const urls = await signedImageUrls([row]);
			onMessage(mapChat(row, row.image_path ? urls.get(row.image_path) : undefined));
		})
		.subscribe();
	return () => void db().removeChannel(channel);
}

// ---------- Partner storefront & promotions ----------

export interface StorefrontArgs {
	tagline: string;
	fastLaneMinutes?: number;
	bannerUrl?: string;
	logoUrl?: string;
	imageUrl?: string;
}

/** Images must be URLs from uploadStoreImage(); the server refuses anything else */
export async function updateStorefront(a: StorefrontArgs): Promise<void> {
	check(
		await db().rpc('update_storefront', {
			p_tagline: a.tagline,
			p_banner_url: a.bannerUrl ?? '',
			p_fast_lane_minutes: a.fastLaneMinutes ?? null,
			p_logo_url: a.logoUrl ?? '',
			p_image_url: a.imageUrl ?? ''
		})
	);
}

/** Registers a brand new store and assigns the current authenticated user as owner */
export async function registerPartnerStore(name: string, category: string, zone: string, description = ''): Promise<string> {
	return check(
		await db().rpc('partner_register_store', {
			p_name: name,
			p_category: category,
			p_zone: zone,
			p_description: description
		})
	);
}

/** Claims an unassigned existing store for the current authenticated user */
export async function claimPartnerStore(storeId: string): Promise<void> {
	check(
		await db().rpc('partner_claim_store', {
			p_store_id: storeId
		})
	);
}

/** Uploads a banner, logo or store photo to store-banners/<storeId>/… or falls back to compact embedded image */
export async function uploadStoreImage(storeId: string, file: File, kind: 'banner' | 'logo' | 'photo' | 'menu'): Promise<string> {
	try {
		const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
		const path = `${storeId}/${kind}-${Date.now()}.${ext}`;
		const res = await db().storage.from('store-banners').upload(path, file, { contentType: file.type, upsert: true });
		if (!res.error) {
			return db().storage.from('store-banners').getPublicUrl(path).data.publicUrl;
		}
	} catch (e) {
		console.warn('Storage upload error, using embedded compressed data', e);
	}
	// Direct fallback: compress image on client and return as base64 Data URL (bypasses broken storage)
	return fileToDataUrl(file);
}

export interface MenuItemArgs {
	/** Missing = a new dish */
	id?: string;
	name: string;
	category: string;
	price: number;
	specialPrice?: number;
	description: string;
	/** URL from uploadStoreImage(), or the dish's current photo */
	imageUrl: string;
	isAvailable: boolean;
	options?: MenuOptionGroup[];
}

/** Add or change a dish of the partner's own store; returns its id */
export async function saveMenuItem(a: MenuItemArgs): Promise<string> {
	return check(
		await db().rpc('partner_save_menu_item', {
			p_id: a.id ?? null,
			p_name: a.name,
			p_category: a.category,
			p_price: a.price,
			p_special_price: a.specialPrice ?? null,
			p_description: a.description,
			p_image_url: a.imageUrl,
			p_available: a.isAvailable,
			p_options: a.options ?? []
		})
	) as string;
}

/** Take a dish off the menu (kept for old orders, hidden everywhere else) */
export async function removeMenuItem(id: string): Promise<void> {
	check(await db().rpc('partner_remove_menu_item', { p_id: id }));
}

export async function updateStoreInfo(a: { name: string; category: string; description: string; queueMinutes: number }): Promise<void> {
	check(await db().rpc('partner_update_store_info', { p_name: a.name, p_category: a.category, p_description: a.description, p_queue_minutes: a.queueMinutes }));
}

export type PromotionDraft = Omit<Promotion, 'id' | 'approved'> & { id?: string };

export async function savePromotion(p: PromotionDraft): Promise<Promotion> {
	const row = {
		store_id: p.storeId,
		kind: p.kind,
		title: p.title,
		description: p.description,
		min_qty: p.minQty,
		discount: p.discount,
		free_delivery: p.freeDelivery,
		banner_url: p.bannerUrl ?? null,
		ends_at: p.endsAt ?? null,
		active: p.active
	};
	const query = p.id ? db().from('promotions').update(row).eq('id', p.id) : db().from('promotions').insert(row);
	return mapPromotion(check(await query.select().single()) as Row);
}

export async function deletePromotion(id: string): Promise<void> {
	check(await db().from('promotions').delete().eq('id', id));
}

// ---------- Rider (คนหิ้ว) ----------

function mapRiderJob(r: Row): RiderJob {
	return {
		id: r.id,
		orderCode: r.order_code,
		kind: r.kind,
		storeId: r.store_id ?? undefined,
		pickupName: r.pickup_name,
		dropoffName: r.dropoff_name,
		itemDetails: r.item_details,
		items: (r.items as RiderJob['items'] | null) ?? [],
		foodTotal: r.food_total,
		deliveryFee: r.delivery_fee,
		totalPrice: r.total_price,
		paymentMethod: r.payment_method,
		status: r.status,
		tip: r.tip ?? 0,
		storeDiscount: r.store_discount ?? 0,
		note: r.note ?? undefined,
		createdAt: r.created_at,
		acceptedAt: r.accepted_at ?? undefined,
		customer: r.customer ? { nickname: r.customer.nickname, phone: r.customer.phone } : undefined
	};
}

export interface RiderBoard {
	capacity: number;
	/** Switched on and seen in the last 10 minutes */
	online: boolean;
	open: RiderJob[];
	mine: RiderJob[];
}

/** null when this account is not on the rider roster */
export async function fetchRiderBoard(): Promise<RiderBoard | null> {
	const board = check(await db().rpc('rider_board')) as Row | null;
	if (!board) return null;
	return { capacity: board.capacity, online: !!board.online, open: (board.open as Row[]).map(mapRiderJob), mine: (board.mine as Row[]).map(mapRiderJob) };
}

export async function acceptJob(orderId: string): Promise<void> {
	check(await db().rpc('accept_order', { p_order_id: orderId }));
}

export async function releaseJob(orderId: string): Promise<void> {
	check(await db().rpc('release_order', { p_order_id: orderId }));
}

export async function markPickedUp(orderId: string): Promise<void> {
	check(await db().rpc('mark_delivering', { p_order_id: orderId }));
}

/** true when the OTP matched and the order is now COMPLETED */
export async function confirmDelivery(orderId: string, otp: string): Promise<boolean> {
	return check(await db().rpc('confirm_delivery', { p_order_id: orderId, p_otp: otp })) as boolean;
}

/** The rider's finished jobs in the last `days` days, newest first (RLS: only their own) */
export async function fetchRiderEarnings(riderId: string, days = 30): Promise<RiderEarning[]> {
	const since = new Date(Date.now() - days * 86_400_000).toISOString();
	const rows = check(
		await db()
			.from('orders')
			.select('id, order_code, completed_at, pickup_name, dropoff_name, payment_method, food_total, delivery_fee, total_price, tip, tip_in_total, store_discount, payout_paid_at, payout_ref')
			.eq('rider_id', riderId)
			.eq('status', 'COMPLETED')
			.gte('completed_at', since)
			.order('completed_at', { ascending: false })
			.limit(300)
	) as Row[];
	return rows.map((r) => {
		// Only a tip paid with the order counts (older rating-screen tips were never paid in)
		const tip = r.tip_in_total ? (r.tip ?? 0) : 0;
		return {
			id: r.id,
			orderCode: r.order_code,
			completedAt: r.completed_at,
			pickupName: r.pickup_name,
			dropoffName: r.dropoff_name,
			paymentMethod: r.payment_method,
			foodTotal: r.food_total,
			deliveryFee: r.delivery_fee,
			totalPrice: r.total_price,
			tip,
			storeDiscount: r.store_discount ?? 0,
			owed: Math.max(0, owedToRider({ payment: r.payment_method, food_total: r.food_total, delivery_fee: r.delivery_fee, total: r.total_price, tip, store_discount: r.store_discount ?? 0 })),
			paidOutAt: r.payout_paid_at ?? undefined,
			payoutRef: r.payout_ref ?? undefined
		};
	});
}

/** Switch rider mode's "พร้อมรับงาน" on or off; calling it again keeps the rider counted as ready */
export async function setRiderOnline(online: boolean): Promise<void> {
	check(await db().rpc('set_rider_online', { p_online: online }));
}

/** Riders ready right now, for the home page */
export async function fetchRidersOnline(): Promise<number> {
	return check(await db().rpc('riders_online')) as number;
}

export interface RiderApplication {
	id: string;
	status: 'PENDING' | 'APPROVED' | 'REJECTED';
	availability: string;
	note: string | null;
	reviewNote: string | null;
	createdAt: string;
	reviewedAt: string | null;
}

/** The student's latest rider application, or null */
export async function fetchMyRiderApplication(): Promise<RiderApplication | null> {
	const r = check(await db().rpc('my_rider_application')) as Row | null;
	return r ? { id: r.id, status: r.status, availability: r.availability, note: r.note, reviewNote: r.review_note, createdAt: r.created_at, reviewedAt: r.reviewed_at } : null;
}

export async function applyRider(availability: string, note: string): Promise<void> {
	check(await db().rpc('apply_rider', { p_availability: availability, p_note: note }));
}

/** Any change to orders a rider can see (RLS filters the feed): new jobs, jobs taken, own round */
export function subscribeRiderBoard(onChange: () => void): () => void {
	const channel = db()
		.channel('rider-board')
		.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => onChange())
		.subscribe();
	return () => void db().removeChannel(channel);
}

// ---------- Partner dashboard ----------

export async function fetchPartnerDashboard(days: 7 | 30): Promise<PartnerDashboard> {
	const d = check(await db().rpc('partner_dashboard', { p_days: days })) as Row;
	const n = (v: unknown) => Number(v ?? 0);
	return {
		storeId: d.store_id,
		isOpen: d.is_open,
		today: { sales: n(d.today.sales), orders: n(d.today.orders), items: n(d.today.items), discounts: n(d.today.discounts), cancelled: n(d.today.cancelled), onTheWay: n(d.today.on_the_way) },
		month: { sales: n(d.month.sales), orders: n(d.month.orders) },
		days: (d.days as Row[]).map((x) => ({ day: x.day, sales: n(x.sales), orders: n(x.orders) })),
		topItems: (d.top_items as Row[]).map((x) => ({ name: x.name, qty: n(x.qty), sales: n(x.sales) })),
		live: (d.live as Row[]).map((x) => ({
			id: x.id,
			code: x.code,
			status: x.status,
			createdAt: x.created_at,
			acceptedAt: x.accepted_at ?? undefined,
			note: x.note ?? undefined,
			foodTotal: n(x.food_total),
			rider: x.rider ?? null,
			items: (x.items as Row[] | null) ?? []
		})) as PartnerDashboard['live'],
		recent: (d.recent as Row[]).map((x) => ({ id: x.id, code: x.code, completedAt: x.completed_at, foodTotal: n(x.food_total), partnerDiscount: n(x.partner_discount), items: x.items ?? '' }))
	};
}

/** The partner opens or closes their own store to app orders */
export async function setMyStoreOpen(open: boolean, opts: { hours?: number; rev?: number } = {}): Promise<StoreOpenStatus> {
	return check(await db().rpc('partner_set_store_open', { p_open: open, p_hours: opts.hours ?? null, p_rev: opts.rev ?? null })) as StoreOpenStatus;
}

/** Why the partner's store is open or closed right now, as the database sees it */
export async function fetchMyStoreOpenStatus(): Promise<StoreOpenStatus> {
	return check(await db().rpc('partner_store_open_status')) as StoreOpenStatus;
}

/** Drop the hand switch and let the schedule run the store again */
export async function followMySchedule(rev?: number): Promise<StoreOpenStatus> {
	return check(await db().rpc('partner_follow_schedule', { p_rev: rev ?? null })) as StoreOpenStatus;
}

/** A store's open flag, hours or visibility changed (buyers, owner and team all hear it) */
export function subscribeStores(onChange: (row: Row) => void): () => void {
	const channel = db()
		.channel('stores-open')
		.on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, (payload) => {
			if (payload.new && 'id' in payload.new) onChange(payload.new as Row);
		})
		.subscribe();
	return () => void db().removeChannel(channel);
}

/** Just the fields buyers act on, from a stores row */
export function storeLiveFields(r: Row): Pick<Store, 'isOpen' | 'operatingHours' | 'hidden'> {
	return { isOpen: !!r.is_open, operatingHours: r.operating_hours ?? undefined, hidden: r.hidden ?? false };
}

/** The partner marks one of their dishes available or sold out */
export async function setMyItemAvailable(itemId: string, available: boolean): Promise<void> {
	check(await db().rpc('partner_set_item_available', { p_item_id: itemId, p_available: available }));
}

/** The partner saves automated operating hours for their store */
export async function setMyOperatingHours(hours: OperatingHours, rev?: number): Promise<StoreOpenStatus> {
	return check(await db().rpc('partner_set_operating_hours', { p_hours: hours, p_rev: rev ?? null })) as StoreOpenStatus;
}

// ---------- Home Banners ----------

export async function fetchHomeBanners(): Promise<HomeBanner[]> {
	try {
		const { data, error } = await db().from('home_banners').select('*').order('sort', { ascending: true });
		if (error || !data) return [];
		return (data as Row[]).map((r) => ({
			id: r.id,
			imageUrl: r.image_url,
			title: r.title ?? '',
			subtitle: r.subtitle ?? '',
			linkUrl: r.link_url ?? undefined,
			buttonText: r.button_text ?? undefined,
			active: !!r.active,
			sort: Number(r.sort ?? 0)
		}));
	} catch {
		return [];
	}
}

export async function saveHomeBanner(banner: HomeBanner): Promise<string> {
	return check(
		await db().rpc('admin_save_home_banner', {
			p_id: banner.id || null,
			p_image_url: banner.imageUrl,
			p_title: banner.title,
			p_subtitle: banner.subtitle,
			p_link_url: banner.linkUrl ?? null,
			p_button_text: banner.buttonText ?? 'ฝากหิ้วเลย',
			p_active: banner.active,
			p_sort: banner.sort
		})
	) as string;
}

export async function deleteHomeBanner(id: string): Promise<void> {
	check(await db().rpc('admin_delete_home_banner', { p_id: id }));
}


