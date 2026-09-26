// Every Supabase call the app makes lives here, so stores stay mode-agnostic and
// the row ↔ type mapping has exactly one home. Only imported on live paths.
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { CartItem, ChatMessage, MenuItem, Order, OrderStatus, PaymentMethod, Promotion, Rider, RiderJob, Store, User } from '$lib/types';
import { base } from '$app/paths';
import { db } from '$lib/supabase';
import { formatTime } from '$lib/utils';

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
		category: r.category ?? ''
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
		jobs: Number(r.jobs),
		phone: r.phone
	};
}

/** Order JSON from my_orders(); line items resolve against the catalogue when possible */
function mapOrder(r: Row, findItem: (id: string) => MenuItem | undefined): Order {
	const items: CartItem[] | undefined = (r.items as Row[] | null)?.map((i) => ({
		quantity: i.quantity,
		special: !!i.special,
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
	const row = check(await db().from('stores').select('*, menu_items(*), promotions(*)').eq('id', storeId).single());
	if (!row) throw new Error('STORE_NOT_FOUND');
	return mapStore(row);
}

// ---------- Orders ----------

export interface StoreOrderArgs {
	storeId: string;
	items: { menuItemId: string; quantity: number; special?: boolean }[];
	dropoffName: string;
	note?: string;
	paymentMethod: PaymentMethod;
	promoCode?: string;
}

export async function placeStoreOrder(a: StoreOrderArgs): Promise<string> {
	return check(
		await db().rpc('place_order', {
			p_store_id: a.storeId,
			p_items: a.items.map((i) => ({ menu_item_id: i.menuItemId, quantity: i.quantity, special: !!i.special })),
			p_dropoff: a.dropoffName,
			p_note: a.note ?? '',
			p_payment: a.paymentMethod,
			p_promo_code: a.promoCode ?? null
		})
	) as string;
}

export async function placeCustomOrder(a: { pickupName: string; itemDetails: string; estimated: number; dropoffName: string; note?: string }): Promise<string> {
	return check(
		await db().rpc('place_custom_order', {
			p_pickup: a.pickupName,
			p_items: a.itemDetails,
			p_estimated: a.estimated,
			p_dropoff: a.dropoffName,
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

export async function rateOrder(orderId: string, rating: number, tags: string[], tip: number): Promise<void> {
	check(await db().rpc('rate_order', { p_order_id: orderId, p_rating: rating, p_tags: tags, p_tip: tip }));
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

export async function sendChat(orderId: string, senderId: string, text: string, file?: File): Promise<ChatMessage> {
	let imagePath: string | null = null;
	if (file) {
		const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
		imagePath = `${orderId}/${crypto.randomUUID()}.${ext}`;
		check(await db().storage.from('chat-images').upload(imagePath, file, { contentType: file.type }));
	}
	const row = check(
		await db()
			.from('chat_messages')
			.insert({ order_id: orderId, sender_id: senderId, sender_role: 'CUSTOMER', body: text, image_path: imagePath })
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

/** Uploads a banner, logo or store photo to store-banners/<storeId>/… and returns the public URL */
export async function uploadStoreImage(storeId: string, file: File, kind: 'banner' | 'logo' | 'photo'): Promise<string> {
	const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
	const path = `${storeId}/${kind}-${Date.now()}.${ext}`;
	check(await db().storage.from('store-banners').upload(path, file, { contentType: file.type, upsert: true }));
	return db().storage.from('store-banners').getPublicUrl(path).data.publicUrl;
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
		note: r.note ?? undefined,
		createdAt: r.created_at,
		acceptedAt: r.accepted_at ?? undefined,
		customer: r.customer ? { nickname: r.customer.nickname, phone: r.customer.phone } : undefined
	};
}

export interface RiderBoard {
	capacity: number;
	open: RiderJob[];
	mine: RiderJob[];
}

/** null when this account is not on the rider roster */
export async function fetchRiderBoard(): Promise<RiderBoard | null> {
	const board = check(await db().rpc('rider_board')) as Row | null;
	if (!board) return null;
	return { capacity: board.capacity, open: (board.open as Row[]).map(mapRiderJob), mine: (board.mine as Row[]).map(mapRiderJob) };
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

/** Any change to orders a rider can see (RLS filters the feed): new jobs, jobs taken, own round */
export function subscribeRiderBoard(onChange: () => void): () => void {
	const channel = db()
		.channel('rider-board')
		.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => onChange())
		.subscribe();
	return () => void db().removeChannel(channel);
}
