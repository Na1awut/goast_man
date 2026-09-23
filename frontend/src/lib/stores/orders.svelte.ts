// Orders, simulated runner matching and per-order chat (Svelte 5 runes)
//
// The simulation mirrors the backend state machine
// PENDING → ACCEPTED → DELIVERING → COMPLETED so the timers can later be
// replaced by ORDER_ACCEPTED / ORDER_DELIVERING / ORDER_COMPLETED WebSocket events.
import type { CartItem, ChatMessage, Order, OrderKind, PaymentMethod } from '$lib/types';
import { pickRider, RIDER_POOL } from '$lib/data/riders';
import { getStoreById } from '$lib/data/stores';
import { nowTime, randomDigits4, uid } from '$lib/utils';
import { toast } from './toast.svelte';

const ACCEPT_AFTER_MS = 3000;
const DELIVERING_AFTER_MS = 8000;
const CHAT_REPLY_AFTER_MS = 2000;

/** Resolve [menuItemId, qty] pairs against the catalogue (seed data only) */
function seedItems(storeId: string, lines: [string, number][]): CartItem[] {
	const store = getStoreById(storeId);
	return lines.flatMap(([id, quantity]) => {
		const menuItem = store?.menuItems.find((m) => m.id === id);
		return menuItem ? [{ menuItem, quantity }] : [];
	});
}

export const ACTIVE_STATUSES: Order['status'][] = ['PENDING', 'ACCEPTED', 'DELIVERING'];

export interface NewOrderInput {
	kind: OrderKind;
	storeId?: string;
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
	note?: string;
}

function autoReply(text: string): string {
	const t = text.toLowerCase();
	if (/ขอบคุณ|thank/.test(t)) return 'ยินดีครับ ขอให้อร่อยนะครับ';
	if (/ถึง|มา|ไหน|นาน/.test(t)) return 'อีกประมาณ 2-3 นาทีถึงครับ กำลังเดินข้ามสะพานลอยอยู่';
	if (/รอ|ตู้|หน้า|นั่ง|เสื้อ/.test(t)) return 'รับทราบครับ ถึงแล้วเดี๋ยวมองหานะครับ';
	if (/เผ็ด|ไม่ใส่|เพิ่ม|ผัก|ซอส/.test(t)) return 'ได้ครับ เดี๋ยวบอกแม่ค้าให้ครับ';
	return 'รับทราบครับ';
}

class OrdersStore {
	orders = $state<Order[]>([]);
	currentOrderId = $state<string | null>(null);
	chats = $state<Record<string, ChatMessage[]>>({});
	typingOrderId = $state<string | null>(null);
	onlineRiders = $state(42);

	active = $derived(this.orders.filter((o) => ACTIVE_STATUSES.includes(o.status)));
	history = $derived(this.orders.filter((o) => !ACTIVE_STATUSES.includes(o.status)));
	completed = $derived(this.orders.filter((o) => o.status === 'COMPLETED'));
	current = $derived(this.orders.find((o) => o.id === this.currentOrderId) ?? null);
	currentChat = $derived(this.currentOrderId ? (this.chats[this.currentOrderId] ?? []) : []);
	totalSpent = $derived(this.completed.reduce((sum, o) => sum + o.totalPrice + (o.tip ?? 0), 0));

	#timers = new Map<string, ReturnType<typeof setTimeout>[]>();
	#ridersTicker: ReturnType<typeof setInterval> | null = null;

	init() {
		this.#seedHistory();
		this.#startRidersTicker();
	}

	open(orderId: string) {
		this.currentOrderId = orderId;
	}

	place(input: NewOrderInput): Order {
		let orderCode: string;
		do {
			orderCode = `#KM-${randomDigits4()}`;
		} while (this.orders.some((o) => o.orderCode === orderCode));

		const order: Order = {
			...input,
			id: uid('ord'),
			orderCode,
			customerId: 'u-demo-001',
			status: 'PENDING',
			otpCode: randomDigits4(),
			createdAt: new Date().toISOString()
		};
		this.orders = [order, ...this.orders];
		this.currentOrderId = order.id;
		this.chats[order.id] = [{ id: uid('msg'), sender: 'SYSTEM', text: `สร้างออเดอร์ ${orderCode} แล้ว กำลังหาเพื่อนรับหิ้ว`, time: nowTime() }];
		toast.show(`สร้างออเดอร์ ${orderCode} แล้ว กำลังหาเพื่อนรับหิ้ว`, 'success', { notify: true });
		this.#simulateRunner(order.id);
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
			this.#system(orderId, `${rider.name} รับงานหิ้วแล้ว`);
			this.chats[orderId].push({ id: uid('msg'), sender: 'RIDER', text: `สวัสดีครับ ${rider.name} รับออเดอร์แล้วนะครับ กำลังไปต่อคิวให้`, time: nowTime() });
			toast.show(`${rider.name} (${rider.faculty}) รับงานหิ้วแล้ว`, 'success', { notify: true });
		});

		this.#schedule(orderId, DELIVERING_AFTER_MS, () => {
			const order = this.#get(orderId);
			if (order?.status !== 'ACCEPTED') return;
			order.status = 'DELIVERING';
			order.deliveringAt = new Date().toISOString();
			this.#system(orderId, 'คนหิ้วได้รับของครบแล้ว กำลังเดินมาส่ง');
			toast.show(`${order.rider?.name ?? 'คนหิ้ว'} ซื้อของครบแล้ว กำลังเดินมาส่ง เตรียมรหัส OTP ไว้ได้เลย`, 'info', { notify: true });
		});
	}

	/** Demo hook: the runner typed the correct OTP on their device */
	confirmDelivery(orderId: string, otp: string): boolean {
		const order = this.#get(orderId);
		if (!order || order.status !== 'DELIVERING' || order.otpCode !== otp) return false;
		order.status = 'COMPLETED';
		order.completedAt = new Date().toISOString();
		this.#clearTimers(orderId);
		this.#system(orderId, 'ยืนยัน OTP สำเร็จ ส่งมอบเรียบร้อย');
		toast.show(`ส่งมอบ ${order.orderCode} เรียบร้อย`, 'success', { notify: true });
		return true;
	}

	cancel(orderId: string): boolean {
		const order = this.#get(orderId);
		if (order?.status !== 'PENDING') return false;
		order.status = 'CANCELLED';
		this.#clearTimers(orderId);
		toast.show(`ยกเลิกออเดอร์ ${order.orderCode} แล้ว`, 'warning', { notify: true });
		return true;
	}

	rate(orderId: string, rating: number, tags: string[], tip: number) {
		const order = this.#get(orderId);
		if (!order) return;
		// 0 = skipped rating; the tip is still recorded
		order.rating = rating > 0 ? Math.min(5, Math.max(1, Math.round(rating))) : undefined;
		order.feedbackTags = tags;
		order.tip = Math.max(0, tip);
	}

	sendChat(orderId: string, text: string, imageUrl?: string) {
		const message = text.trim();
		const order = this.#get(orderId);
		if ((!message && !imageUrl) || !order) return;
		(this.chats[orderId] ??= []).push({ id: uid('msg'), sender: 'CUSTOMER', text: message, time: nowTime(), imageUrl });

		if (!order.rider || order.status === 'COMPLETED' || order.status === 'CANCELLED') return;
		this.typingOrderId = orderId;
		this.#schedule(orderId, CHAT_REPLY_AFTER_MS, () => {
			this.chats[orderId]?.push({ id: uid('msg'), sender: 'RIDER', text: imageUrl && !message ? 'เห็นรูปแล้วครับ' : autoReply(message), time: nowTime() });
			if (this.typingOrderId === orderId) this.typingOrderId = null;
		});
	}

	#startRidersTicker() {
		if (this.#ridersTicker) return;
		this.#ridersTicker = setInterval(() => {
			const delta = Math.floor(Math.random() * 5) - 2;
			this.onlineRiders = Math.min(68, Math.max(28, this.onlineRiders + delta));
		}, 4000);
	}

	reset() {
		this.#timers.forEach((list) => list.forEach(clearTimeout));
		this.#timers.clear();
		if (this.#ridersTicker) clearInterval(this.#ridersTicker);
		this.#ridersTicker = null;
		this.orders = [];
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
				storeId: 'store-boba',
				customerId: 'u-demo-001',
				rider: RIDER_POOL[1],
				pickupName: 'BobaLab ชานมไข่มุก มจธ.',
				dropoffName: 'อาคารเรียนรวม CB2',
				itemDetails: 'ชานมไข่มุก Original ×1, มัทฉะลาเต้ ×1',
				items: seedItems('store-boba', [['bb1', 1], ['bb3', 1]]),
				foodTotal: 100,
				deliveryFee: 15,
				codeDiscount: 0,
				partnerDiscount: 10,
				totalPrice: 105,
				paymentMethod: 'PROMPTPAY',
				status: 'COMPLETED',
				otpCode: '3391',
				createdAt: hoursAgo(26),
				acceptedAt: hoursAgo(25.9),
				deliveringAt: hoursAgo(25.8),
				completedAt: hoursAgo(25.6),
				rating: 5,
				feedbackTags: ['ส่งไวมาก ⚡'],
				tip: 5
			},
			{
				id: 'ord-seed-6100',
				orderCode: '#KM-6100',
				kind: 'CUSTOM',
				customerId: 'u-demo-001',
				rider: RIDER_POOL[2],
				pickupName: 'เซเว่นหน้าหอใน มจธ.',
				dropoffName: 'หอพักหญิง S6',
				itemDetails: 'ขนมปัง + นมจืด 2 กล่อง + ขนมขบเคี้ยว 2 ถุง',
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

/** Draft state for the custom (ฝากซื้อ) form, so Home shortcuts can preselect a pickup */
class CustomDraft {
	pickupId = $state('canteen-male');
}

export const customDraft = new CustomDraft();
