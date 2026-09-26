// SAMPLE DATA for trying the team console without a database (demo mode).
// Store names and menus are the app's real catalogue; every person, phone
// number, order and amount here is made up. Never shown to buyers.
import { DROPOFF_POINTS } from '$lib/data/locations';
import { STORE_CATALOGUE } from '$lib/data/stores';
import type { AdminApi, OrderQuery } from './api';
import { attentionOf, owedToRider, stageOf } from './rules';
import { bangkokToday } from './format';
import type {
	AdminMenuItem,
	AdminPromo,
	AdminRider,
	LogEntry,
	MoneyEntry,
	OrderDetail,
	OrderRow,
	OrdersTab,
	Overview,
	Payment,
	Stage,
	TeamMe,
	TeamMember,
	TeamRole
} from './types';

export const DEMO_ADMIN: TeamMe = { email: 'admin.demo@mail.kmutt.ac.th', role: 'ADMIN', nickname: 'แอดมินทดลอง', full_name: 'แอดมิน ทดลอง' };

type Status = Exclude<Stage, 'AWAITING_PAYMENT'>;

interface DemoPerson {
	id: string;
	email: string;
	nickname: string;
	full_name: string;
	phone: string;
	faculty: string;
	level: string;
}

interface DemoOrder {
	id: string;
	code: string;
	store_id: string;
	pickup: string;
	dropoff: string;
	customer: DemoPerson;
	rider: DemoPerson | null;
	status: Status;
	payment: Payment;
	created_at: string;
	paid_at: string | null;
	accepted_at: string | null;
	delivering_at: string | null;
	completed_at: string | null;
	cancelled_at: string | null;
	cancel_reason: string | null;
	cancelled_by: string | null;
	payment_confirmed_by: string | null;
	slip_ref: string | null;
	refunded_at: string | null;
	refund_ref: string | null;
	payout_paid_at: string | null;
	items: { name: string; price: number; quantity: number }[];
	food_total: number;
	delivery_fee: number;
	code_discount: number;
	total: number;
	otp_failed: number;
	note: string | null;
}

const FEE = 15;
const MIN = 60_000;

function rng(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const person = (i: number, nickname: string, full_name: string, faculty: string, level: string): DemoPerson => ({
	id: `demo-user-${i}`,
	email: `demo.${i}@mail.kmutt.ac.th`,
	nickname,
	full_name,
	phone: `08${String(10000000 + i * 7919).slice(0, 8)}`,
	faculty,
	level
});

const CUSTOMERS = [
	person(1, 'มายด์', 'ธนพร ทดลอง', 'คณะวิทยาศาสตร์', 'ปี 2'),
	person(2, 'ต้นกล้า', 'กล้า ตัวอย่าง', 'คณะวิศวกรรมศาสตร์', 'ปี 3'),
	person(3, 'ปราง', 'ปรางทิพย์ สมมติ', 'คณะเทคโนโลยีสารสนเทศ (SIT)', 'ปี 1'),
	person(4, 'บอส', 'ภูวดล ทดลอง', 'คณะวิศวกรรมศาสตร์', 'ปี 4'),
	person(5, 'ฟ้า', 'ฟ้าใส ตัวอย่าง', 'คณะศิลปศาสตร์', 'ปี 2'),
	person(6, 'เจ', 'เจตน์ สมมติ', 'คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี', 'ปี 3'),
	person(7, 'มิว', 'มิวสิก ทดลอง', 'คณะสถาปัตยกรรมศาสตร์และการออกแบบ', 'ปี 1'),
	person(8, 'ออม', 'ออมสิน ตัวอย่าง', 'คณะวิทยาศาสตร์', 'ปี 4')
];

const RIDERS = [
	person(21, 'พี', 'พีรพล ทดลอง', 'คณะวิศวกรรมศาสตร์', 'ปี 3'),
	person(22, 'มิน', 'มินตรา ตัวอย่าง', 'คณะวิทยาศาสตร์', 'ปี 2'),
	person(23, 'เฟิร์น', 'เฟิร์นนี่ สมมติ', 'คณะเทคโนโลยีสารสนเทศ (SIT)', 'ปี 3'),
	person(24, 'บาส', 'บาสเกต ทดลอง', 'คณะวิศวกรรมศาสตร์', 'ปี 4'),
	person(25, 'อาร์ม', 'อาร์มสตรอง ตัวอย่าง', 'คณะศิลปศาสตร์', 'ปี 2'),
	person(26, 'จูน', 'จูนจิรา สมมติ', 'คณะวิทยาศาสตร์', 'ปี 1')
];

function buildOrders(now: number): DemoOrder[] {
	const rand = rng(20260926);
	const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
	const iso = (minutesAgo: number) => new Date(now - minutesAgo * MIN).toISOString();
	const orders: DemoOrder[] = [];
	let code = 3060;

	const make = (minutesAgo: number, status: Status, payment: Payment, extra: Partial<DemoOrder> = {}): DemoOrder => {
		const store = pick(STORE_CATALOGUE);
		const items = Array.from({ length: 1 + Math.floor(rand() * 2) }, () => {
			const m = pick(store.menuItems);
			return { name: m.name, price: m.price, quantity: 1 };
		});
		const food = items.reduce((s, i) => s + i.price * i.quantity, 0);
		const discount = rand() < 0.15 ? 15 : 0;
		const created = iso(minutesAgo);
		const rider = status === 'PENDING' || (status === 'CANCELLED' && rand() < 0.6) ? null : pick(RIDERS);
		const accepted = rider ? iso(minutesAgo - 3) : null;
		const o: DemoOrder = {
			id: `demo-order-${code}`,
			code: `#KM-${code++}`,
			store_id: store.id,
			pickup: store.name,
			dropoff: pick(DROPOFF_POINTS).name,
			customer: pick(CUSTOMERS),
			rider,
			status,
			payment,
			created_at: created,
			paid_at: payment === 'PROMPTPAY' ? iso(minutesAgo - 1) : null,
			accepted_at: accepted,
			delivering_at: status === 'DELIVERING' || status === 'COMPLETED' ? iso(minutesAgo - 9) : null,
			completed_at: status === 'COMPLETED' ? iso(Math.max(0, minutesAgo - 18)) : null,
			cancelled_at: status === 'CANCELLED' ? iso(minutesAgo - 5) : null,
			cancel_reason: status === 'CANCELLED' ? 'ผู้ซื้อขอยกเลิก' : null,
			cancelled_by: null,
			payment_confirmed_by: null,
			slip_ref: payment === 'PROMPTPAY' ? `0${String(4000000 + code * 13)}SLIP` : null,
			refunded_at: status === 'CANCELLED' && payment === 'PROMPTPAY' ? iso(minutesAgo - 20) : null,
			refund_ref: null,
			payout_paid_at: status === 'COMPLETED' && minutesAgo > 90 ? iso(30) : null,
			items,
			food_total: food,
			delivery_fee: FEE,
			code_discount: discount,
			total: food + FEE - discount,
			otp_failed: 0,
			note: rand() < 0.2 ? 'นั่งโต๊ะหน้าลิฟต์ เสื้อสีขาว' : null,
			...extra
		};
		return o;
	};

	// A lunch service that started a little under three hours ago
	for (let m = 175; m > 45; m -= 3 + Math.floor(rand() * 4)) {
		orders.push(make(m, rand() < 0.08 ? 'CANCELLED' : 'COMPLETED', rand() < 0.4 ? 'PROMPTPAY' : 'CASH'));
	}
	for (let m = 38; m > 2; m -= 4 + Math.floor(rand() * 3)) {
		const status: Status = m > 22 ? 'DELIVERING' : m > 12 ? 'ACCEPTED' : 'PENDING';
		orders.push(make(m, status, rand() < 0.4 ? 'PROMPTPAY' : 'CASH'));
	}
	// One of each problem, so every chip and fix can be tried
	orders.push(make(47, 'DELIVERING', 'CASH', { otp_failed: 5 }));
	orders.push(make(52, 'CANCELLED', 'PROMPTPAY', { refunded_at: null, cancel_reason: 'ร้านปิดหรือของหมด', cancelled_by: 'ทีมงานทดลอง' }));
	orders.push(make(44, 'ACCEPTED', 'CASH'));
	orders.push(make(13, 'PENDING', 'CASH'));
	orders.push(make(19, 'PENDING', 'PROMPTPAY', { paid_at: null, slip_ref: null }));
	return orders;
}

function slotsOf(orders: DemoOrder[]) {
	const day = bangkokToday();
	const bkkMinutes = (iso: string) => {
		const t = new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
		const [h, m] = t.split(':').map(Number);
		return h * 60 + m;
	};
	const today = orders.filter((o) => new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) === day);
	const mins = today.map((o) => bkkMinutes(o.created_at));
	// Sample orders follow the clock, so the chart covers their own time range
	const start = Math.floor(Math.min(...mins, 24 * 60 - 15) / 15) * 15;
	const end = Math.max(...mins, start);
	const out = [];
	for (let s = start; s <= end; s += 15) {
		const inSlot = today.filter((o, i) => mins[i] >= s && mins[i] < s + 15);
		out.push({
			at: `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`,
			orders: inSlot.length,
			gmv: inSlot.filter((o) => o.status !== 'CANCELLED').reduce((n, o) => n + o.total, 0)
		});
	}
	return { today, slots: out };
}

const wait = <T>(value: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(value)), 120));
const fail = (code: string) => Promise.reject(new Error(code));

export type DemoApi = AdminApi & { demoSetRole(role: TeamRole): void };

export function createDemoApi(): DemoApi {
	const now = () => Date.now();
	let me: TeamMe = { ...DEMO_ADMIN };
	const orders = buildOrders(now());
	const stores = STORE_CATALOGUE.map((s) => ({ id: s.id, name: s.name, category: s.category, lock: s.lock, image_url: s.imageUrl, logo_url: null, is_open: true, is_partner: s.id === 'kfc-05' }));
	const menu = new Map<string, AdminMenuItem[]>(
		STORE_CATALOGUE.map((s) => [s.id, s.menuItems.map((m) => ({ id: m.id, name: m.name, price: m.price, special_price: m.specialPrice ?? null, category: m.category, is_available: m.id !== 'kfc-04-8' }))])
	);
	const roster: AdminRider[] = RIDERS.map((r, i) => ({
		email: r.email,
		note: 'ตรวจบัตร นศ. และอบรมการส่ง/OTP แล้ว',
		added_at: new Date(now() - (20 - i) * 86_400_000).toISOString(),
		added_by: DEMO_ADMIN.nickname,
		user_id: r.id,
		nickname: r.nickname,
		full_name: r.full_name,
		phone: r.phone,
		faculty: r.faculty,
		level: r.level,
		holding: 0,
		delivering: false,
		busy: false,
		jobs_today: 0,
		jobs_total: 30 + i * 7,
		rating: [4.9, 4.8, 5, 4.7, 4.9, 4.6][i]
	}));
	const promos: AdminPromo[] = [
		{ id: 'demo-promo-1', store_id: 'kfc-04', store: 'Dino Papa EXPRESS', store_image: 'stores/kfc-04.webp', kind: 'CO_PROMO', title: 'ไอศกรีมคู่ ลด 10 บาท', description: '', min_qty: 2, discount: 10, free_delivery: false, ends_at: null, active: true, approved: false, created_at: new Date(now() - 2 * 3600_000).toISOString(), review_note: null, state: 'PENDING', uses: 0 },
		{ id: 'demo-promo-2', store_id: 'kfc-05', store: 'ร้านข้าวมันไก่ & ข้าวหมกไก่ (HALAL FOODS)', store_image: 'stores/kfc-05.webp', kind: 'DEAL', title: 'สั่ง 3 กล่อง ฟรีค่าหิ้ว', description: '', min_qty: 3, discount: 0, free_delivery: true, ends_at: null, active: true, approved: true, created_at: new Date(now() - 5 * 86_400_000).toISOString(), review_note: null, state: 'LIVE', uses: 6 }
	];
	const invites: { email: string; store_id: string; store: string; invited_at: string }[] = [];
	const team: TeamMember[] = [
		{ email: DEMO_ADMIN.email, role: 'ADMIN', note: 'แอดมินคนแรก', added_at: new Date(now() - 30 * 86_400_000).toISOString(), added_by: null, name: DEMO_ADMIN.nickname, full_name: DEMO_ADMIN.full_name, has_account: true, is_me: true },
		{ email: 'staff.demo@mail.kmutt.ac.th', role: 'STAFF', note: 'กะเที่ยง', added_at: new Date(now() - 7 * 86_400_000).toISOString(), added_by: DEMO_ADMIN.nickname, name: 'ทีมงานทดลอง', full_name: 'ทีมงาน ทดลอง', has_account: true, is_me: false }
	];
	const history: MoneyEntry[] = [];
	const log: LogEntry[] = [];
	let logId = 1;

	const record = (action: string, target_type: string, target_id: string, target: string, detail: Record<string, unknown> = {}) => {
		log.unshift({ id: logId++, at: new Date().toISOString(), by: me.nickname, action, target_type, target_id, target, detail });
	};
	record('STORE_OPENED', 'store', 'kfc-02', 'ครัวกรุงศรี (KRUA KRUNGSRI)');

	const ruleView = (o: DemoOrder) => ({ status: o.status, payment: o.payment, created_at: o.created_at, paid_at: o.paid_at, refunded_at: o.refunded_at, total: o.total, otp_failed: o.otp_failed });
	const row = (o: DemoOrder): OrderRow => ({
		id: o.id,
		code: o.code,
		kind: 'STORE',
		stage: stageOf(ruleView(o)),
		status: o.status,
		created_at: o.created_at,
		store_id: o.store_id,
		pickup: o.pickup,
		dropoff: o.dropoff,
		total: o.total,
		payment: o.payment,
		paid_at: o.paid_at,
		customer: o.customer.nickname,
		rider: o.rider?.nickname ?? null,
		attention: attentionOf(ruleView(o), now())
	});
	const find = (id: string) => orders.find((o) => o.id === id);
	const isToday = (iso: string, day: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) === day;
	const liveOf = (r: DemoPerson) => orders.filter((o) => o.rider?.id === r.id && (o.status === 'ACCEPTED' || o.status === 'DELIVERING'));
	const due = () =>
		orders
			.filter((o) => o.status === 'COMPLETED' && o.rider && !o.payout_paid_at && owedToRider({ payment: o.payment, food_total: o.food_total, delivery_fee: o.delivery_fee, total: o.total }) > 0)
			.map((o) => ({ o, owed: owedToRider({ payment: o.payment, food_total: o.food_total, delivery_fee: o.delivery_fee, total: o.total }) }));

	const inTab = (r: OrderRow, tab: OrdersTab) =>
		tab === 'attention'
			? r.attention.length > 0
			: tab === 'active'
				? ['PENDING', 'ACCEPTED', 'DELIVERING'].includes(r.stage)
				: tab === 'awaiting_payment'
					? r.stage === 'AWAITING_PAYMENT'
					: tab === 'done'
						? r.status === 'COMPLETED'
						: tab === 'cancelled'
							? r.status === 'CANCELLED'
							: true;

	return {
		me: () => wait(me),

		async overview(day = bangkokToday()) {
			const { today, slots } = slotsOf(orders.filter((o) => isToday(o.created_at, day)));
			const live = orders.filter((o) => ['PENDING', 'ACCEPTED', 'DELIVERING'].includes(o.status));
			const counts = Object.fromEntries((['AWAITING_PAYMENT', 'PENDING', 'ACCEPTED', 'DELIVERING', 'COMPLETED', 'CANCELLED'] as Stage[]).map((s) => [s, today.filter((o) => row(o).stage === s).length])) as Record<Stage, number>;
			const accepted = today.filter((o) => o.accepted_at);
			const byStore = new Map<string, { id: string; name: string; orders: number; gmv: number }>();
			for (const o of today) {
				const s = byStore.get(o.store_id) ?? { id: o.store_id, name: o.pickup, orders: 0, gmv: 0 };
				s.orders++;
				if (o.status !== 'CANCELLED') s.gmv += o.total;
				byStore.set(o.store_id, s);
			}
			const owed = due();
			const overview: Overview = {
				day,
				is_today: day === bangkokToday(),
				orders: today.length,
				gmv: today.filter((o) => o.status !== 'CANCELLED').reduce((n, o) => n + o.total, 0),
				food: today.filter((o) => o.status !== 'CANCELLED').reduce((n, o) => n + o.food_total, 0),
				fees: today.filter((o) => o.status !== 'CANCELLED').reduce((n, o) => n + o.delivery_fee, 0),
				waiting_rider: live.filter((o) => o.status === 'PENDING' && (o.payment === 'CASH' || o.paid_at)).length,
				awaiting_payment: live.filter((o) => o.status === 'PENDING' && o.payment === 'PROMPTPAY' && !o.paid_at).length,
				delivering: live.filter((o) => o.status !== 'PENDING').length,
				stores_open: stores.filter((s) => s.is_open).length,
				stores_total: stores.length,
				riders_busy: new Set(live.filter((o) => o.rider).map((o) => o.rider!.id)).size,
				riders_total: roster.length,
				refunds_due: orders.filter((o) => o.status === 'CANCELLED' && o.paid_at && !o.refunded_at).length,
				refunds_due_amount: orders.filter((o) => o.status === 'CANCELLED' && o.paid_at && !o.refunded_at).reduce((n, o) => n + o.total, 0),
				rider_cost_day: today.filter((o) => o.status === 'COMPLETED').reduce((n, o) => n + owedToRider({ payment: o.payment, food_total: o.food_total, delivery_fee: o.delivery_fee, total: o.total }), 0),
				payouts_due: owed.reduce((n, d) => n + d.owed, 0),
				payouts_due_riders: new Set(owed.map((d) => d.o.rider!.id)).size,
				avg_accept_minutes: accepted.length ? Math.round((accepted.reduce((n, o) => n + (Date.parse(o.accepted_at!) - Date.parse(o.paid_at ?? o.created_at)) / MIN, 0) / accepted.length) * 10) / 10 : null,
				problems: orders.filter((o) => row(o).attention.length > 0).length,
				pending_promos: promos.filter((p) => p.state === 'PENDING').length,
				slots,
				status_counts: counts,
				top_stores: [...byStore.values()].sort((a, b) => b.orders - a.orders || b.gmv - a.gmv).slice(0, 5),
				riders: RIDERS.map((r) => {
					const jobs = liveOf(r).sort((a, b) => Number(b.status === 'DELIVERING') - Number(a.status === 'DELIVERING'));
					const j = jobs[0];
					return { id: r.id, nickname: r.nickname, job_code: j?.code ?? null, job_pickup: j?.pickup ?? null, job_dropoff: j?.dropoff ?? null, job_status: (j?.status as 'ACCEPTED' | 'DELIVERING') ?? null, holding: jobs.length, busy: !!j };
				}).sort((a, b) => Number(b.busy) - Number(a.busy))
			};
			return wait(overview);
		},

		async orders(q: OrderQuery) {
			const day = q.day ?? bangkokToday();
			const text = q.search?.trim().toLowerCase() ?? '';
			const digits = text.replace(/\D/g, '');
			const base = orders
				.filter((o) => (!q.store || o.store_id === q.store) && (!q.payment || o.payment === q.payment))
				.filter((o) => !text || o.code.toLowerCase().includes(text) || (digits.length >= 4 && o.code.includes(digits)) || [o.customer, o.rider].some((p) => p && (p.nickname.includes(text) || (digits.length >= 4 && p.phone.includes(digits)))))
				.map(row);
			const dayRows = base.filter((r) => isToday(r.created_at, day));
			const pool = q.tab === 'attention' ? base : dayRows;
			const rows = pool
				.filter((r) => inTab(r, q.tab))
				.sort((a, b) => (q.tab === 'attention' ? a.attention[0].rank - b.attention[0].rank || Date.parse(a.created_at) - Date.parse(b.created_at) : Date.parse(b.created_at) - Date.parse(a.created_at)));
			const counts = Object.fromEntries((['attention', 'active', 'awaiting_payment', 'done', 'cancelled', 'all'] as OrdersTab[]).map((t) => [t, (t === 'attention' ? base : dayRows).filter((r) => inTab(r, t)).length])) as Record<OrdersTab, number>;
			const offset = q.offset ?? 0;
			return wait({ rows: rows.slice(offset, offset + (q.limit ?? 50)), total: rows.length, counts });
		},

		async order(id) {
			const o = find(id);
			if (!o) return fail('ORDER_NOT_FOUND');
			const store = STORE_CATALOGUE.find((s) => s.id === o.store_id);
			const detail: OrderDetail = {
				...row(o),
				note: o.note,
				food_total: o.food_total,
				delivery_fee: o.delivery_fee,
				code_discount: o.code_discount,
				partner_discount: 0,
				promo_code: o.code_discount ? 'KMUTTFIRST' : null,
				slip_ref: o.slip_ref,
				accepted_at: o.accepted_at,
				delivering_at: o.delivering_at,
				completed_at: o.completed_at,
				cancelled_at: o.cancelled_at,
				cancel_reason: o.cancel_reason,
				cancelled_by: o.cancelled_by,
				payment_confirmed_by: o.payment_confirmed_by,
				refunded_at: o.refunded_at,
				refund_ref: o.refund_ref,
				payout_paid_at: o.payout_paid_at,
				rating: o.status === 'COMPLETED' ? 5 : null,
				tip: 0,
				otp_failed: o.otp_failed,
				store: store ? { id: store.id, name: store.name, lock: store.lock, image_url: store.imageUrl } : null,
				items: o.items,
				customer_info: { ...o.customer, promptpay: o.customer.phone },
				rider_info: o.rider ? { ...o.rider, holding: liveOf(o.rider).length } : null,
				activity: log.filter((l) => l.target_type === 'order' && l.target_id === o.id).map((l) => ({ at: l.at, by: l.by, action: l.action, detail: l.detail }))
			};
			return wait(detail);
		},

		async cancelOrder(id, reason) {
			const o = find(id);
			if (!o) return fail('ORDER_NOT_FOUND');
			if (!reason.trim()) return fail('REASON_REQUIRED');
			if (o.status === 'COMPLETED' || o.status === 'CANCELLED') return fail('BAD_STATE');
			Object.assign(o, { status: 'CANCELLED', cancelled_at: new Date().toISOString(), cancelled_by: me.nickname, cancel_reason: reason.trim() });
			record('ORDER_CANCELLED', 'order', o.id, o.code, { reason: reason.trim() });
			return wait(undefined);
		},
		async confirmPayment(id, ref) {
			const o = find(id);
			if (!o) return fail('ORDER_NOT_FOUND');
			if (!ref.trim()) return fail('REF_REQUIRED');
			if (o.payment !== 'PROMPTPAY' || o.status !== 'PENDING') return fail('ORDER_NOT_PAYABLE');
			if (o.paid_at) return fail('ALREADY_PAID');
			Object.assign(o, { paid_at: new Date().toISOString(), slip_ref: `MANUAL:${ref.trim()}`, payment_confirmed_by: me.nickname });
			record('PAYMENT_CONFIRMED', 'order', o.id, o.code, { amount: o.total, ref: ref.trim() });
			return wait(undefined);
		},
		async unlockOtp(id) {
			const o = find(id);
			if (!o) return fail('ORDER_NOT_FOUND');
			if (o.otp_failed < 5) return fail('NOT_LOCKED');
			o.otp_failed = 0;
			record('OTP_UNLOCKED', 'order', o.id, o.code);
			return wait(undefined);
		},
		async requeueOrder(id, reason) {
			const o = find(id);
			if (!o) return fail('ORDER_NOT_FOUND');
			if (!reason.trim()) return fail('REASON_REQUIRED');
			if (o.status !== 'ACCEPTED') return fail('BAD_STATE');
			record('ORDER_REQUEUED', 'order', o.id, o.code, { reason: reason.trim(), rider: o.rider?.nickname });
			Object.assign(o, { status: 'PENDING', rider: null, accepted_at: null });
			return wait(undefined);
		},
		async markRefunded(id, ref) {
			const o = find(id);
			if (!o) return fail('ORDER_NOT_FOUND');
			if (!ref.trim()) return fail('REF_REQUIRED');
			if (o.status !== 'CANCELLED' || !o.paid_at || o.refunded_at) return fail('BAD_STATE');
			Object.assign(o, { refunded_at: new Date().toISOString(), refund_ref: ref.trim() });
			history.unshift({ kind: 'REFUND', at: o.refunded_at!, recipient: o.customer.nickname, amount: o.total, jobs: 1, ref: ref.trim(), by: me.nickname });
			record('REFUNDED', 'order', o.id, o.code, { amount: o.total, ref: ref.trim() });
			return wait(undefined);
		},

		async payouts() {
			const byRider = new Map<string, ReturnType<typeof due>>();
			for (const d of due()) byRider.set(d.o.rider!.id, [...(byRider.get(d.o.rider!.id) ?? []), d]);
			return wait(
				[...byRider.values()]
					.map((list) => {
						const r = list[0].o.rider!;
						const sorted = list.sort((a, b) => Date.parse(a.o.completed_at!) - Date.parse(b.o.completed_at!));
						return {
							rider_id: r.id,
							name: r.nickname,
							email: r.email,
							promptpay: r.phone,
							faculty: r.faculty,
							level: r.level,
							owed: list.reduce((n, d) => n + d.owed, 0),
							jobs: list.length,
							oldest: sorted[0].o.completed_at!,
							orders: sorted.map(({ o, owed }) => ({ order_id: o.id, code: o.code, completed_at: o.completed_at!, payment: o.payment, food: o.food_total, fee: o.delivery_fee, cash: o.payment === 'CASH' ? o.total : 0, owed }))
						};
					})
					.sort((a, b) => Date.parse(a.oldest) - Date.parse(b.oldest))
			);
		},
		async markPayout(riderId, orderIds, ref) {
			const list = due().filter((d) => d.o.rider!.id === riderId && orderIds.includes(d.o.id));
			if (list.length !== orderIds.length) return fail('PAYOUT_CHANGED');
			const amount = list.reduce((n, d) => n + d.owed, 0);
			const at = new Date().toISOString();
			for (const d of list) d.o.payout_paid_at = at;
			const rider = list[0].o.rider!;
			history.unshift({ kind: 'PAYOUT', at, recipient: rider.nickname, amount, jobs: list.length, ref: ref.trim() || null, by: me.nickname });
			record('PAYOUT_PAID', 'rider', rider.id, rider.nickname, { amount, jobs: list.length, ref: ref.trim() || null });
			return wait({ amount });
		},
		refundsDue: () =>
			wait(
				orders
					.filter((o) => o.status === 'CANCELLED' && o.paid_at && !o.refunded_at)
					.map((o) => ({ order_id: o.id, code: o.code, amount: o.total, cancelled_at: o.cancelled_at!, reason: o.cancel_reason, cancelled_by: o.cancelled_by, customer: o.customer.nickname, phone: o.customer.phone, promptpay: o.customer.phone }))
			),
		moneyHistory: () => wait(history),

		stores: () =>
			wait(
				stores.map((s) => ({
					...s,
					orders_today: orders.filter((o) => o.store_id === s.id && isToday(o.created_at, bangkokToday())).length,
					items_total: menu.get(s.id)!.length,
					items_off: menu.get(s.id)!.filter((m) => !m.is_available).length
				}))
			),
		storeMenu: (id) => wait(menu.get(id) ?? []),
		async setStoreOpen(id, open) {
			const s = stores.find((x) => x.id === id);
			if (!s) return fail('STORE_NOT_FOUND');
			s.is_open = open;
			record(open ? 'STORE_OPENED' : 'STORE_CLOSED', 'store', s.id, s.name);
			return wait(undefined);
		},
		async setItemAvailable(itemId, available) {
			for (const [storeId, items] of menu) {
				const m = items.find((i) => i.id === itemId);
				if (m) {
					m.is_available = available;
					record(available ? 'ITEM_ON' : 'ITEM_OFF', 'store', storeId, stores.find((s) => s.id === storeId)!.name, { item: m.name });
					return wait(undefined);
				}
			}
			return fail('ITEM_NOT_FOUND');
		},

		riders: () =>
			wait(
				roster
					.map((r) => {
						const person = RIDERS.find((p) => p.email === r.email);
						const jobs = person ? liveOf(person) : [];
						const today = person ? orders.filter((o) => o.rider?.id === person.id && o.status === 'COMPLETED' && isToday(o.completed_at!, bangkokToday())).length : 0;
						return { ...r, holding: jobs.length, delivering: jobs.some((j) => j.status === 'DELIVERING'), busy: jobs.length > 0, jobs_today: today, jobs_total: r.jobs_total + today };
					})
					.sort((a, b) => Number(b.busy) - Number(a.busy))
			),
		async addRider(email, note) {
			const e = email.trim().toLowerCase();
			if (me.role !== 'ADMIN') return fail('ADMIN_ONLY');
			if (!/^[^@\s]+@(mail\.)?kmutt\.ac\.th$/.test(e)) return fail('KMUTT_ONLY');
			if (roster.some((r) => r.email === e)) return fail('ALREADY_RIDER');
			roster.push({ email: e, note: note.trim() || null, added_at: new Date().toISOString(), added_by: me.nickname, user_id: null, nickname: null, full_name: null, phone: '', faculty: '', level: null, holding: 0, delivering: false, busy: false, jobs_today: 0, jobs_total: 0, rating: null });
			record('RIDER_ADDED', 'rider', e, e, { note: note.trim() || null });
			return wait(undefined);
		},
		async removeRider(email, reason) {
			if (me.role !== 'ADMIN') return fail('ADMIN_ONLY');
			if (!reason.trim()) return fail('REASON_REQUIRED');
			const i = roster.findIndex((r) => r.email === email);
			if (i < 0) return fail('NOT_A_RIDER');
			roster.splice(i, 1);
			record('RIDER_REMOVED', 'rider', email, email, { reason: reason.trim() });
			return wait(undefined);
		},

		promotions: () => wait(promos),
		async reviewPromo(id, approve, note) {
			if (me.role !== 'ADMIN') return fail('ADMIN_ONLY');
			const p = promos.find((x) => x.id === id);
			if (!p) return fail('PROMO_NOT_FOUND');
			if (!approve && !note.trim()) return fail('REASON_REQUIRED');
			Object.assign(p, { approved: approve, active: approve, review_note: approve ? null : note.trim(), state: approve ? 'LIVE' : 'REJECTED' });
			record(approve ? 'PROMO_APPROVED' : 'PROMO_REJECTED', 'promotion', p.id, `${p.store} · ${p.title}`, { note: note.trim() || null });
			return wait(undefined);
		},
		async setPromoActive(id, active) {
			if (me.role !== 'ADMIN') return fail('ADMIN_ONLY');
			const p = promos.find((x) => x.id === id);
			if (!p) return fail('PROMO_NOT_FOUND');
			Object.assign(p, { active, state: active ? (p.kind === 'CO_PROMO' && !p.approved ? 'PENDING' : 'LIVE') : 'OFF' });
			record(active ? 'PROMO_ON' : 'PROMO_OFF', 'promotion', p.id, `${p.store} · ${p.title}`);
			return wait(undefined);
		},
		partners: () =>
			wait({
				partners: [{ store_id: 'kfc-05', store: 'ร้านข้าวมันไก่ & ข้าวหมกไก่ (HALAL FOODS)', owner_email: 'demo.shop@example.com', owner_name: 'บัญชีร้านทดลอง', joined_at: new Date(now() - 10 * 86_400_000).toISOString() }],
				invites
			}),
		async invitePartner(email, storeId) {
			if (me.role !== 'ADMIN') return fail('ADMIN_ONLY');
			const e = email.trim().toLowerCase();
			if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return fail('BAD_EMAIL');
			if (storeId === 'kfc-05') return fail('STORE_HAS_OWNER');
			const store = stores.find((s) => s.id === storeId);
			if (!store) return fail('STORE_NOT_FOUND');
			invites.unshift({ email: e, store_id: storeId, store: store.name, invited_at: new Date().toISOString() });
			record('PARTNER_INVITED', 'store', storeId, store.name, { email: e });
			return wait(undefined);
		},
		async cancelInvite(email) {
			if (me.role !== 'ADMIN') return fail('ADMIN_ONLY');
			const i = invites.findIndex((x) => x.email === email);
			if (i < 0) return fail('INVITE_NOT_FOUND');
			const [inv] = invites.splice(i, 1);
			record('INVITE_CANCELLED', 'store', inv.store_id, inv.store, { email });
			return wait(undefined);
		},

		async team() {
			if (me.role !== 'ADMIN') return fail('ADMIN_ONLY');
			return wait(team.map((m) => ({ ...m, is_me: m.email === me.email })));
		},
		async setMember(email, role: TeamRole, note) {
			if (me.role !== 'ADMIN') return fail('ADMIN_ONLY');
			const e = email.trim().toLowerCase();
			if (!/^[^@\s]+@(mail\.)?kmutt\.ac\.th$/.test(e)) return fail('KMUTT_ONLY');
			if (e === me.email) return fail('CANNOT_CHANGE_SELF');
			const m = team.find((x) => x.email === e);
			if (m) m.role = role;
			else team.push({ email: e, role, note: note?.trim() || null, added_at: new Date().toISOString(), added_by: me.nickname, name: null, full_name: null, has_account: false, is_me: false });
			record(m ? 'MEMBER_ROLE_CHANGED' : 'MEMBER_ADDED', 'member', e, e, { role });
			return wait(undefined);
		},
		async removeMember(email) {
			if (me.role !== 'ADMIN') return fail('ADMIN_ONLY');
			if (email === me.email) return fail('CANNOT_CHANGE_SELF');
			const i = team.findIndex((x) => x.email === email);
			if (i < 0) return fail('NOT_A_MEMBER');
			const [m] = team.splice(i, 1);
			record('MEMBER_REMOVED', 'member', email, email, { role: m.role });
			return wait(undefined);
		},

		async activity(limit = 100) {
			if (me.role !== 'ADMIN') return fail('ADMIN_ONLY');
			return wait(log.slice(0, limit));
		},

		/** Demo only: look at the console the way STAFF sees it */
		demoSetRole(role: TeamRole) {
			me = { ...me, role };
		}
	};
}
