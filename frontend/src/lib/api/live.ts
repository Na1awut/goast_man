// Every Supabase call the app makes lives here, so stores stay mode-agnostic and
// the row ↔ type mapping has exactly one home. Only imported on live paths.
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { CartItem, ChatMessage, MenuItem, Order, OrderStatus, PaymentMethod, Promotion, Rider, Store, User } from '$lib/types';
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
	return profile ? mapProfile(profile) : null;
}

/**
 * Redirects to Google. Students get the @kmutt.ac.th account hint; partner shop
 * owners may use any Google account that an admin has invited. The database
 * trigger rejects everyone else, whatever the hint says.
 */
export async function signInWithGoogle(asPartner: boolean): Promise<void> {
	const { error } = await db().auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo: window.location.origin,
			queryParams: asPartner ? { prompt: 'select_account' } : { hd: 'kmutt.ac.th', prompt: 'select_account' }
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
	items: { menuItemId: string; quantity: number }[];
	dropoffName: string;
	note?: string;
	paymentMethod: PaymentMethod;
	promoCode?: string;
}

export async function placeStoreOrder(a: StoreOrderArgs): Promise<string> {
	return check(
		await db().rpc('place_order', {
			p_store_id: a.storeId,
			p_items: a.items.map((i) => ({ menu_item_id: i.menuItemId, quantity: i.quantity })),
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

export async function updateStorefront(tagline: string, bannerUrl: string | undefined, fastLaneMinutes: number | undefined): Promise<void> {
	check(await db().rpc('update_storefront', { p_tagline: tagline, p_banner_url: bannerUrl ?? '', p_fast_lane_minutes: fastLaneMinutes ?? null }));
}

/** Uploads to store-banners/<storeId>/… and returns the public URL */
export async function uploadBanner(storeId: string, file: File): Promise<string> {
	const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
	const path = `${storeId}/${Date.now()}.${ext}`;
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
