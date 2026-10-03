// Orders and per-order chat (Svelte 5 runes)
//
// Live mode: Supabase is the source of truth. Orders are created by the
// place_order / place_custom_order RPCs (server-side pricing), and status
// changes arrive over Realtime from the rider app.
//
// Demo mode: an in-memory copy of the same state machine
// PENDING → ACCEPTED → DELIVERING → COMPLETED, driven by timers.
import type { CartItem, ChatMessage, MenuItem, Order, OrderKind, OrderStatus, PaymentMethod } from '$lib/types';
import * as api from '$lib/api/live';
import { pickRider, RIDER_POOL } from '$lib/data/riders';
import { findStore, STORE_CATALOGUE } from '$lib/data/stores';
import { friendlyError, isLive } from '$lib/supabase';
import { awaitingPayment } from '$lib/payments';
import { nowTime, randomDigits4, uid } from '$lib/utils';
import { catalog } from './catalog.svelte';
import { toast } from './toast.svelte';
import { t } from '$lib/i18n';

const ACCEPT_AFTER_MS = 3000;
const DELIVERING_AFTER_MS = 8000;
const CHAT_REPLY_AFTER_MS = 2000;

/** Resolve [menuItemId, qty] pairs against the demo catalogue (seed data only) */
function seedItems(storeId: string, lines: [string, number][]): CartItem[] {
	const store = findStore(STORE_CATALOGUE, storeId);
	return lines.flatMap(([id, quantity]) => {
		const menuItem = store?.menuItems.find((m) => m.id === id);
		return menuItem ? [{ menuItem, quantity }] : [];
	});
}

function findMenuItem(id: string): MenuItem | undefined {
	for (const store of catalog.stores) {
		const item = store.menuItems.find((m) => m.id === id);
		if (item) return item;
	}
	return undefined;
}

export const ACTIVE_STATUSES: Order['status'][] = ['PENDING', 'ACCEPTED', 'DELIVERING'];

export interface NewOrderInput {
	kind: OrderKind;
	storeId?: string;
	pickupName: string;
	dropoffName: string;
	/** Building and floor: the database prices the delivery from them */
	dropoffId: string;
	floor: number;
	itemDetails: string;
	items?: CartItem[];
	foodTotal: number;
	deliveryFee: number;
	codeDiscount: number;
	partnerDiscount: number;
	promoCode?: string;
	totalPrice: number;
	/** Round-up tip, already inside totalPrice */
	tip?: number;
	paymentMethod: PaymentMethod;
	note?: string;
}

/** Thrown by place()/cancel() with a message ready to show */
export class OrderError extends Error {}

const STATUS_TOAST: Partial<Record<OrderStatus, (o: Order) => string>> = {
	PENDING: (o) => t('คนหิ้วคืนงาน {orderCode} กำลังหาเพื่อนคนใหม่', { orderCode: o.orderCode }),
	ACCEPTED: (o) => t('{v} รับงานหิ้ว {orderCode} แล้ว', { v: o.rider?.name ?? t('เพื่อน'), orderCode: o.orderCode }),
	DELIVERING: (o) => t('{v} ซื้อของครบแล้ว กำลังเดินมาส่ง เตรียมรหัส OTP ไว้ได้เลย', { v: o.rider?.name ?? t('คนหิ้ว') }),
	COMPLETED: (o) => t('ส่งมอบ {orderCode} เรียบร้อย', { orderCode: o.orderCode }),
	CANCELLED: (o) => t('ออเดอร์ {orderCode} ถูกยกเลิก', { orderCode: o.orderCode })
};

function autoReply(text: string): string {
	const lower = text.toLowerCase();
	if (/ขอบคุณ|thank/.test(lower)) return t('ยินดีครับ ขอให้อร่อยนะครับ');
	if (/ถึง|มา|ไหน|นาน/.test(lower)) return t('อีกประมาณ 2-3 นาทีถึงครับ กำลังเดินข้ามสะพานลอยอยู่');
	if (/รอ|ตู้|หน้า|นั่ง|เสื้อ/.test(lower)) return t('รับทราบครับ ถึงแล้วเดี๋ยวมองหานะครับ');
	if (/เผ็ด|ไม่ใส่|เพิ่ม|ผัก|ซอส/.test(lower)) return t('ได้ครับ เดี๋ยวบอกแม่ค้าให้ครับ');
	return t('รับทราบครับ');
}

class OrdersStore {
	orders = $state<Order[]>([]);
	currentOrderId = $state<string | null>(null);
	chats = $state<Record<string, ChatMessage[]>>({});
	typingOrderId = $state<string | null>(null);
	/** Riders switched on as ready (live: riders_online(), every minute). null = unknown, so hidden rather than invented */
	onlineRiders = $state<number | null>(isLive ? null : 42);
	/** The first load of my orders has finished (or failed) */
	loaded = $state(false);

	active = $derived(this.orders.filter((o) => ACTIVE_STATUSES.includes(o.status)));
	history = $derived(this.orders.filter((o) => !ACTIVE_STATUSES.includes(o.status)));
	completed = $derived(this.orders.filter((o) => o.status === 'COMPLETED'));
	current = $derived(this.orders.find((o) => o.id === this.currentOrderId) ?? null);
	currentChat = $derived(this.currentOrderId ? (this.chats[this.currentOrderId] ?? []) : []);
	totalSpent = $derived(this.completed.reduce((sum, o) => sum + o.totalPrice, 0));

	#timers = new Map<string, ReturnType<typeof setTimeout>[]>();
	#ridersTicker: ReturnType<typeof setInterval> | null = null;
	#unsubscribeOrders: (() => void) | null = null;
	#unsubscribeChat: (() => void) | null = null;
	#customerId: string | null = null;

	async init(customerId: string) {
		this.#customerId = customerId;
		if (!isLive) {
			this.#seedHistory();
			this.#startRidersTicker();
			this.loaded = true;
			return;
		}
		try {
			this.orders = await api.fetchMyOrders(findMenuItem);
		} catch (err) {
			toast.show(friendlyError(err), 'error');
		}
		this.loaded = true;
		this.#unsubscribeOrders?.();
		this.#unsubscribeOrders = api.subscribeMyOrders(customerId, (orderId) => void this.#refresh(orderId, true));
		this.#startRidersTicker();
	}

	/** The connection came back: read all my orders again, since events may have been missed while offline */
	async reloadAll() {
		if (!isLive || !this.#customerId) return;
		try {
			this.orders = await api.fetchMyOrders(findMenuItem);
		} catch {
			// Still flaky: the next realtime event or reconnect tries again
		}
	}

	/** Re-read one order from the server (after a realtime event or our own RPC) */
	/** Re-read one order from the server (live), e.g. after its slip was verified */
	async reload(orderId: string): Promise<Order | undefined> {
		return isLive ? this.#refresh(orderId) : this.orders.find((o) => o.id === orderId);
	}

	async #refresh(orderId: string, announce = false): Promise<Order | undefined> {
		const [fresh] = await api.fetchMyOrders(findMenuItem, orderId);
		if (!fresh) return;
		const before = this.orders.find((o) => o.id === orderId);
		this.orders = before ? this.orders.map((o) => (o.id === orderId ? fresh : o)) : [fresh, ...this.orders];
		if (announce && before && before.status !== fresh.status) {
			const text = STATUS_TOAST[fresh.status]?.(fresh);
			if (text) toast.show(text, fresh.status === 'CANCELLED' ? 'warning' : 'success', { notify: true });
		}
		return fresh;
	}

	open(orderId: string) {
		this.currentOrderId = orderId;
		if (!isLive) return;
		this.#unsubscribeChat?.();
		this.#unsubscribeChat = api.subscribeChat(orderId, (message) => this.#appendChat(orderId, message));
		api
			.fetchChat(orderId)
			.then((messages) => (this.chats[orderId] = messages))
			.catch((err) => toast.show(friendlyError(err), 'error'));
	}

	#appendChat(orderId: string, message: ChatMessage) {
		const list = (this.chats[orderId] ??= []);
		if (!list.some((m) => m.id === message.id)) list.push(message);
	}

	async place(input: NewOrderInput): Promise<Order> {
		if (isLive) return this.#placeLive(input);

		let orderCode: string;
		do {
			orderCode = `#KM-${randomDigits4()}`;
		} while (this.orders.some((o) => o.orderCode === orderCode));

		const order: Order = {
			...input,
			id: uid('ord'),
			orderCode,
			customerId: this.#customerId ?? 'u-demo-001',
			// The demo payment screen "pays" before the order is placed
			paidAt: input.paymentMethod === 'PROMPTPAY' ? new Date().toISOString() : undefined,
			status: 'PENDING',
			otpCode: randomDigits4(),
			createdAt: new Date().toISOString()
		};
		this.orders = [order, ...this.orders];
		this.currentOrderId = order.id;
		this.chats[order.id] = [{ id: uid('msg'), sender: 'SYSTEM', text: t('สร้างออเดอร์ {orderCode} แล้ว กำลังหาเพื่อนรับหิ้ว', { orderCode }), time: nowTime() }];
		toast.show(t('สร้างออเดอร์ {orderCode} แล้ว กำลังหาเพื่อนรับหิ้ว', { orderCode }), 'success', { notify: true });
		this.#simulateRunner(order.id);
		return order;
	}

	async #placeLive(input: NewOrderInput): Promise<Order> {
		let id: string;
		try {
			id =
				input.kind === 'STORE' && input.storeId && input.items
					? await api.placeStoreOrder({
							storeId: input.storeId,
							items: input.items.map((i) => ({ menuItemId: i.menuItem.id, quantity: i.quantity, special: !!i.special, selectedOptions: i.selectedOptions })),
							dropoffId: input.dropoffId,
							floor: input.floor,
							note: input.note,
							paymentMethod: input.paymentMethod,
							promoCode: input.promoCode,
							tip: input.tip
						})
					: await api.placeCustomOrder({
							pickupName: input.pickupName,
							itemDetails: input.itemDetails,
							estimated: input.foodTotal,
							dropoffId: input.dropoffId,
							floor: input.floor,
							note: input.note
						});
		} catch (err) {
			throw new OrderError(friendlyError(err));
		}
		const order = await this.#refresh(id);
		if (!order) throw new OrderError(t('สร้างออเดอร์แล้ว แต่โหลดข้อมูลไม่สำเร็จ ลองเปิดหน้าคำสั่งซื้อ'));
		this.open(order.id);
		// The server total is authoritative; say so if it differs from the preview
		if (order.totalPrice !== input.totalPrice) {
			toast.show(t('ยอดสุทธิจากระบบคือ {totalPrice} ฿ (ต่างจากที่แสดงก่อนหน้า)', { totalPrice: order.totalPrice }), 'warning', { duration: 6000 });
		}
		toast.show(
			awaitingPayment(order) ? t('สร้างออเดอร์ {orderCode} แล้ว ชำระเงินเพื่อเริ่มหาเพื่อนหิ้ว', { orderCode: order.orderCode }) : t('สร้างออเดอร์ {orderCode} แล้ว กำลังหาเพื่อนรับหิ้ว', { orderCode: order.orderCode }),
			'success',
			{ notify: true }
		);
		return order;
	}

	/** Look up the reactive proxy so mutations propagate */
	#get(orderId: string) {
		return this.orders.find((o) => o.id === orderId);
	}

	#schedule(orderId: string, ms: number, fn: () => void) {
		const list = this.#timers.get(orderId) ?? [];
		list.push(setTimeout(fn, ms));
		this.#timers.set(orderId, list);
	}

	#clearTimers(orderId: string) {
		this.#timers.get(orderId)?.forEach(clearTimeout);
		this.#timers.delete(orderId);
	}

	#system(orderId: string, text: string) {
		(this.chats[orderId] ??= []).push({ id: uid('msg'), sender: 'SYSTEM', text, time: nowTime() });
	}

	#simulateRunner(orderId: string) {
		this.#schedule(orderId, ACCEPT_AFTER_MS, () => {
			const order = this.#get(orderId);
			if (order?.status !== 'PENDING') return;
			const rider = pickRider();
			order.status = 'ACCEPTED';
			order.rider = rider;
			order.acceptedAt = new Date().toISOString();
			this.#system(orderId, t('{name} รับงานหิ้วแล้ว', { name: rider.name }));
			this.chats[orderId].push({ id: uid('msg'), sender: 'RIDER', text: t('สวัสดีครับ {name} รับออเดอร์แล้วนะครับ กำลังไปต่อคิวให้', { name: rider.name }), time: nowTime() });
			toast.show(t('{name} ({faculty}) รับงานหิ้วแล้ว', { name: rider.name, faculty: rider.faculty }), 'success', { notify: true });
		});

		this.#schedule(orderId, DELIVERING_AFTER_MS, () => {
			const order = this.#get(orderId);
			if (order?.status !== 'ACCEPTED') return;
			order.status = 'DELIVERING';
			order.deliveringAt = new Date().toISOString();
			this.#system(orderId, t('คนหิ้วได้รับของครบแล้ว กำลังเดินมาส่ง'));
			toast.show(t('{v} ซื้อของครบแล้ว กำลังเดินมาส่ง เตรียมรหัส OTP ไว้ได้เลย', { v: order.rider?.name ?? t('คนหิ้ว') }), 'info', { notify: true });
		});
	}

	/** Demo hook: the runner typed the correct OTP on their device. Live OTP entry happens in the rider app. */
	confirmDelivery(orderId: string, otp: string): boolean {
		if (isLive) return false;
		const order = this.#get(orderId);
		if (!order || order.status !== 'DELIVERING' || order.otpCode !== otp) return false;
		order.status = 'COMPLETED';
		order.completedAt = new Date().toISOString();
		this.#clearTimers(orderId);
		this.#system(orderId, t('ยืนยัน OTP สำเร็จ ส่งมอบเรียบร้อย'));
		toast.show(t('ส่งมอบ {orderCode} เรียบร้อย', { orderCode: order.orderCode }), 'success', { notify: true });
		return true;
	}

	async cancel(orderId: string): Promise<boolean> {
		if (isLive) {
			try {
				await api.cancelOrder(orderId);
			} catch (err) {
				toast.show(friendlyError(err), 'error');
				return false;
			}
			await this.#refresh(orderId, true);
			return true;
		}
		const order = this.#get(orderId);
		if (order?.status !== 'PENDING') return false;
		order.status = 'CANCELLED';
		this.#clearTimers(orderId);
		toast.show(t('ยกเลิกออเดอร์ {orderCode} แล้ว', { orderCode: order.orderCode }), 'warning', { notify: true });
		return true;
	}

	/** The tip is chosen at checkout (round-up), not here */
	async rate(orderId: string, rating: number, tags: string[]) {
		const order = this.#get(orderId);
		if (!order) return;
		// 0 = skipped rating
		order.rating = rating > 0 ? Math.min(5, Math.max(1, Math.round(rating))) : undefined;
		order.feedbackTags = tags;
		if (isLive) {
			try {
				await api.rateOrder(orderId, rating, tags);
			} catch (err) {
				toast.show(friendlyError(err), 'error');
			}
		}
	}

	async sendChat(orderId: string, text: string, image?: { url: string; file: File }) {
		const message = text.trim();
		const order = this.#get(orderId);
		if ((!message && !image) || !order) return;

		if (isLive) {
			if (!this.#customerId) return;
			try {
				this.#appendChat(orderId, await api.sendChat(orderId, this.#customerId, message, image?.file));
			} catch (err) {
				toast.show(friendlyError(err), 'error');
			}
			return;
		}

		(this.chats[orderId] ??= []).push({ id: uid('msg'), sender: 'CUSTOMER', text: message, time: nowTime(), imageUrl: image?.url });
		if (!order.rider || order.status === 'COMPLETED' || order.status === 'CANCELLED') return;
		this.typingOrderId = orderId;
		this.#schedule(orderId, CHAT_REPLY_AFTER_MS, () => {
			this.chats[orderId]?.push({ id: uid('msg'), sender: 'RIDER', text: image && !message ? t('เห็นรูปแล้วครับ') : autoReply(message), time: nowTime() });
			if (this.typingOrderId === orderId) this.typingOrderId = null;
		});
	}

	#startRidersTicker() {
		if (this.#ridersTicker) return;
		if (isLive) {
			// Zero is shown too: "เพื่อนพร้อมหิ้ว 0 คน" is true. A failed call hides the count instead of guessing.
			const load = () =>
				api.fetchRidersOnline().then(
					(n) => (this.onlineRiders = n),
					() => (this.onlineRiders = null)
				);
			void load();
			this.#ridersTicker = setInterval(() => {
				if (!document.hidden) void load();
			}, 60_000);
			return;
		}
		this.#ridersTicker = setInterval(() => {
			const delta = Math.floor(Math.random() * 5) - 2;
			this.onlineRiders = Math.min(68, Math.max(28, (this.onlineRiders ?? 42) + delta));
		}, 4000);
	}

	reset() {
		customDraft.clear();
		this.#timers.forEach((list) => list.forEach(clearTimeout));
		this.#timers.clear();
		if (this.#ridersTicker) clearInterval(this.#ridersTicker);
		this.#ridersTicker = null;
		this.#unsubscribeOrders?.();
		this.#unsubscribeChat?.();
		this.#unsubscribeOrders = this.#unsubscribeChat = null;
		this.#customerId = null;
		this.orders = [];
		this.loaded = false;
		this.chats = {};
		this.currentOrderId = null;
		this.typingOrderId = null;
	}

	#seedHistory() {
		if (this.orders.length) return;
		const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
		this.orders = [
			{
				id: 'ord-seed-7720',
				orderCode: '#KM-7720',
				kind: 'STORE',
				storeId: 'kfc-05',
				customerId: 'u-demo-001',
				rider: RIDER_POOL[1],
				pickupName: t('ร้านข้าวมันไก่ & ข้าวหมกไก่ (HALAL FOODS)'),
				dropoffName: t('อาคารเรียนรวม CB2'),
				itemDetails: t('ข้าวมันไก่ทอด ×1, ข้าวมันไก่ต้ม ×1'),
				items: seedItems('kfc-05', [['kfc-05-4', 1], ['kfc-05-3', 1]]),
				foodTotal: 75,
				deliveryFee: 15,
				codeDiscount: 0,
				partnerDiscount: 0,
				totalPrice: 90,
				paymentMethod: 'PROMPTPAY',
				paidAt: hoursAgo(26),
				status: 'COMPLETED',
				otpCode: '3391',
				createdAt: hoursAgo(26),
				acceptedAt: hoursAgo(25.9),
				deliveringAt: hoursAgo(25.8),
				completedAt: hoursAgo(25.6),
				rating: 5,
				feedbackTags: [t('ส่งไวมาก')]
			},
			{
				id: 'ord-seed-6100',
				orderCode: '#KM-6100',
				kind: 'CUSTOM',
				customerId: 'u-demo-001',
				rider: RIDER_POOL[2],
				pickupName: t('เซเว่นหน้าหอใน มจธ.'),
				dropoffName: t('หอพักหญิง S6'),
				itemDetails: t('ขนมปัง + นมจืด 2 กล่อง + ขนมขบเคี้ยว 2 ถุง'),
				foodTotal: 95,
				deliveryFee: 20,
				codeDiscount: 0,
				partnerDiscount: 0,
				totalPrice: 115,
				paymentMethod: 'CASH',
				status: 'COMPLETED',
				otpCode: '8420',
				createdAt: hoursAgo(72),
				acceptedAt: hoursAgo(71.9),
				deliveringAt: hoursAgo(71.7),
				completedAt: hoursAgo(71.5),
				rating: 4
			}
		];
	}
}

export const orders = new OrdersStore();

/**
 * Draft of the custom (ฝากซื้อ) form: Home shortcuts preselect the pickup, and
 * what was typed survives a detour to the first-order profile form
 */
class CustomDraft {
	pickupId = $state('kfc-main');
	items = $state('');
	price = $state<number | null>(null);
	note = $state('');

	clear() {
		this.items = '';
		this.price = null;
		this.note = '';
	}
}

export const customDraft = new CustomDraft();
