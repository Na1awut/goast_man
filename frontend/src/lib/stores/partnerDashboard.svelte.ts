// A store owner's own numbers (Svelte 5 runes).
// Live: partner_dashboard(), refreshed every 30 seconds while the overview is open.
// Demo: made-up but steady numbers for the demo shop's real menu, so the page
// can be tried before any store has joined. They are labelled as sample data.
import type { PartnerDashboard, Store } from '$lib/types';
import * as api from '$lib/api/live';
import { friendlyError, isLive } from '$lib/supabase';

const REFRESH_MS = 30_000;

class PartnerDashboardStore {
	data = $state<PartnerDashboard | null>(null);
	days = $state<7 | 30>(7);
	error = $state('');
	#timer: ReturnType<typeof setInterval> | null = null;

	async load(store: Store) {
		try {
			this.data = isLive ? await api.fetchPartnerDashboard(this.days) : demoDashboard(store, this.days);
			this.error = '';
		} catch (err) {
			this.error = friendlyError(err);
		}
	}

	setDays(days: 7 | 30, store: Store) {
		if (days === this.days) return;
		this.days = days;
		void this.load(store);
	}

	/** Keep "orders on the way" current while the overview is on screen */
	start(store: Store) {
		void this.load(store);
		this.#timer ??= setInterval(() => {
			if (!document.hidden) void this.load(store);
		}, REFRESH_MS);
	}

	stop() {
		if (this.#timer) clearInterval(this.#timer);
		this.#timer = null;
	}

	reset() {
		this.stop();
		this.data = null;
		this.error = '';
		this.days = 7;
	}
}

export const partnerDashboard = new PartnerDashboardStore();

// ---------- Demo numbers ----------

/** Small deterministic generator, so the demo shows the same numbers on every reload of a day */
function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const bangkokDay = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10);

function demoDashboard(store: Store, days: 7 | 30): PartnerDashboard {
	const now = Date.now();
	const menu = store.menuItems.filter((m) => m.isAvailable);
	const DAY = 86_400_000;
	const series: PartnerDashboard['days'] = [];
	const counts = new Map<string, { qty: number; sales: number }>();
	let monthSales = 0;
	let monthOrders = 0;
	const thisMonth = bangkokDay(now).slice(0, 7);
	for (let back = 29; back >= 0; back--) {
		const day = bangkokDay(now - back * DAY);
		const rand = mulberry32(Number(day.replaceAll('-', '')) + store.id.length);
		// Today counts only the hours so far; weekends are quieter
		const weekday = new Date(`${day}T12:00:00+07:00`).getDay();
		const hourShare = back === 0 ? Math.min(1, Math.max(0, (new Date(now + 7 * 3_600_000).getUTCHours() - 9) / 6)) : 1;
		const orders = Math.round((weekday === 0 || weekday === 6 ? 3 : 9 + rand() * 8) * hourShare);
		let sales = 0;
		for (let i = 0; i < orders; i++) {
			const item = menu[Math.floor(rand() * menu.length)];
			const qty = 1 + Math.floor(rand() * 2);
			sales += item.price * qty;
			const c = counts.get(item.name) ?? { qty: 0, sales: 0 };
			counts.set(item.name, { qty: c.qty + qty, sales: c.sales + item.price * qty });
		}
		if (back < days) series.push({ day, sales, orders });
		if (day.startsWith(thisMonth)) {
			monthSales += sales;
			monthOrders += orders;
		}
	}
	const today = series.at(-1)!;
	const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
	const line = (i: number, quantity: number) => ({ name: menu[i % menu.length].name, quantity });
	return {
		storeId: store.id,
		isOpen: store.isOpen,
		today: { sales: today.sales, orders: today.orders, items: Math.round(today.orders * 1.4), discounts: 0, cancelled: today.orders > 4 ? 1 : 0, onTheWay: 2 },
		month: { sales: monthSales, orders: monthOrders },
		days: series,
		topItems: [...counts.entries()]
			.map(([name, c]) => ({ name, ...c }))
			.sort((a, b) => b.qty - a.qty)
			.slice(0, 5),
		live: [
			{ id: 'demo-live-1', code: '#KM-3141', status: 'ACCEPTED', createdAt: minutesAgo(6), acceptedAt: minutesAgo(4), foodTotal: menu[0].price * 2, rider: 'พี', items: [line(0, 2)] },
			{ id: 'demo-live-2', code: '#KM-3145', status: 'PENDING', createdAt: minutesAgo(2), note: 'ไม่ใส่ผัก', foodTotal: menu[3 % menu.length].price, rider: null, items: [line(3, 1)] }
		],
		recent: Array.from({ length: Math.min(6, today.orders) }, (_, i) => {
			const item = menu[(i * 5) % menu.length];
			return { id: `demo-recent-${i}`, code: `#KM-31${String(30 - i * 3).padStart(2, '0')}`, completedAt: minutesAgo(15 + i * 22), foodTotal: item.price, partnerDiscount: 0, items: `${item.name} ×1` };
		})
	};
}
