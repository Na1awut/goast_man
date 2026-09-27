// Rider mode: the job board and the rider's current round (Svelte 5 runes)
//
// Live mode: rider_board() + Realtime; every action is an RPC that re-checks
// the roster, capacity and state on the server.
// Demo mode: a few open jobs from made-up classmates, same rules in memory.
// The OTP for demo jobs is DEMO_OTP.
import type { RiderEarning, RiderJob } from '$lib/types';
import { owedToRider } from '$lib/admin/rules';
import * as api from '$lib/api/live';
import { STORE_CATALOGUE, findStore } from '$lib/data/stores';
import { PLACES, planRound, START_OPTIONS, suggestAddOns, toRouteOrder, travelFn, type Route, type RouteOrder } from '$lib/routing';
import { friendlyError, isLive } from '$lib/supabase';
import { auth } from './auth.svelte';
import { catalog } from './catalog.svelte';
import { toast } from './toast.svelte';

export const DEMO_OTP = '1234';
const START_KEY = 'gooseman_rider_start';
const DEFAULT_CAPACITY = 4;
/** Most on-the-way jobs worth showing at once */
const SUGGESTION_LIMIT = 3;
/** Hide on-the-way jobs that would make the round more than this much longer */
const MAX_EXTRA_S = 5 * 60;
const CLOCK_TICK_MS = 30_000;
const travel = travelFn();

export interface JobSuggestion {
	job: RiderJob;
	/** Holding jobs: extra time the add-on costs. Empty-handed: the whole trip */
	seconds: number;
}

export type ConfirmResult = 'ok' | 'wrong' | 'error';

/** "YYYY-MM-DD" in Bangkok, to group jobs by the day they were delivered */
const bangkokDay = (iso: string | number) => new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

const owedFor = (job: Pick<RiderJob, 'paymentMethod' | 'foodTotal' | 'deliveryFee' | 'totalPrice'>) =>
	Math.max(0, owedToRider({ payment: job.paymentMethod, food_total: job.foodTotal, delivery_fee: job.deliveryFee, total: job.totalPrice }));

class RiderStore {
	open = $state<RiderJob[]>([]);
	mine = $state<RiderJob[]>([]);
	capacity = $state(DEFAULT_CAPACITY);
	loaded = $state(false);
	/** Job whose action is in flight, to disable its buttons */
	busyId = $state<string | null>(null);
	startId = $state(START_OPTIONS[0].id);
	/** Ticks so ready times and deadlines stay current while the screen is open */
	now = $state(Date.now());
	/** Finished jobs of the last 30 days, newest first */
	earnings = $state<RiderEarning[]>([]);
	earningsLoaded = $state(false);

	/** Delivered today (Bangkok): jobs and delivery fees earned */
	today = $derived.by(() => {
		const day = bangkokDay(this.now);
		const jobs = this.earnings.filter((e) => bangkokDay(e.completedAt) === day);
		return { jobs: jobs.length, fees: jobs.reduce((sum, e) => sum + e.deliveryFee, 0) };
	});
	/** Still to come from the team */
	unpaid = $derived.by(() => {
		const jobs = this.earnings.filter((e) => e.owed > 0 && !e.paidOutAt);
		return { jobs: jobs.length, amount: jobs.reduce((sum, e) => sum + e.owed, 0) };
	});
	/** Transferred by the team in the last 30 days */
	paidOut = $derived(this.earnings.filter((e) => e.paidOutAt).reduce((sum, e) => sum + e.owed, 0));

	delivering = $derived(this.mine.some((j) => j.status === 'DELIVERING'));
	/** Why taking another job is blocked right now, or '' */
	acceptBlock = $derived(
		this.delivering ? 'เริ่มส่งของแล้ว ส่งรอบนี้ให้ครบก่อนค่อยรับงานใหม่' : this.mine.length >= this.capacity ? `รอบนี้ถือครบ ${this.capacity} งานแล้ว` : ''
	);
	start = $derived(PLACES[this.startId] ?? PLACES[START_OPTIONS[0].id]);

	#mineOrders = $derived(this.mine.map((j) => toRouteOrder(j, this.now, (id) => catalog.byId(id))));

	/** Stop-by-stop plan for the round; null when empty or a job is off the campus map */
	plan = $derived.by<Route | null>(() => {
		const orders = this.#mineOrders;
		if (!orders.length || orders.some((o) => !o)) return null;
		return planRound(this.start, orders as RouteOrder[], travel, this.capacity);
	});

	/** Holding jobs: open jobs on the way. Empty-handed: the quickest jobs from here */
	suggestions = $derived.by<JobSuggestion[]>(() => {
		if (this.acceptBlock || this.#mineOrders.some((o) => !o)) return [];
		const byId = new Map(this.open.map((j) => [j.id, j]));
		const candidates = this.open.flatMap((j) => toRouteOrder(j, this.now, (id) => catalog.byId(id)) ?? []);
		const holding = this.mine.length > 0;
		return suggestAddOns(this.start, this.#mineOrders as RouteOrder[], candidates, travel, {
			capacity: this.capacity,
			maxExtraSeconds: holding ? MAX_EXTRA_S : Infinity
		})
			.slice(0, SUGGESTION_LIMIT)
			.map((s) => ({ job: byId.get(s.order.id)!, seconds: s.extraSeconds }));
	});

	#unsubscribe: (() => void) | null = null;
	#clock: ReturnType<typeof setInterval> | null = null;
	#refreshTimer: ReturnType<typeof setTimeout> | null = null;
	#demoSeeded = false;

	async init() {
		void this.loadEarnings();
		const saved = localStorage.getItem(START_KEY);
		if (saved && PLACES[saved]) this.startId = saved;
		this.#clock ??= setInterval(() => (this.now = Date.now()), CLOCK_TICK_MS);
		if (!isLive) {
			if (!this.#demoSeeded) this.open = demoJobs();
			this.#demoSeeded = true;
			this.loaded = true;
			return;
		}
		await this.refresh();
		this.#unsubscribe ??= api.subscribeRiderBoard(() => this.#scheduleRefresh());
	}

	/** Realtime can fire several events for one change; refetch once */
	#scheduleRefresh() {
		if (this.#refreshTimer) clearTimeout(this.#refreshTimer);
		this.#refreshTimer = setTimeout(() => void this.refresh(), 300);
	}

	async refresh() {
		if (!isLive) return;
		try {
			const board = await api.fetchRiderBoard();
			this.open = board?.open ?? [];
			this.mine = board?.mine ?? [];
			this.capacity = board?.capacity ?? DEFAULT_CAPACITY;
		} catch (err) {
			toast.show(friendlyError(err), 'error');
		} finally {
			this.now = Date.now();
			this.loaded = true;
		}
	}

	async loadEarnings() {
		if (!isLive) {
			if (!this.earningsLoaded) this.earnings = demoEarnings();
			this.earningsLoaded = true;
			return;
		}
		const riderId = auth.user?.id;
		if (!riderId) return;
		try {
			this.earnings = await api.fetchRiderEarnings(riderId);
		} catch (err) {
			toast.show(friendlyError(err), 'error');
		} finally {
			this.earningsLoaded = true;
		}
	}

	setStart(id: string) {
		if (!PLACES[id]) return;
		this.startId = id;
		localStorage.setItem(START_KEY, id);
	}

	/** Runs a live RPC or a demo change, with one busy flag and one error path */
	async #act(job: RiderJob, live: () => Promise<void>, demo: () => string | void, success: string): Promise<boolean> {
		if (this.busyId) return false;
		this.busyId = job.id;
		try {
			if (isLive) {
				await live();
				await this.refresh();
			} else {
				const problem = demo();
				if (problem) {
					toast.show(problem, 'warning');
					return false;
				}
			}
			toast.show(success, 'success');
			return true;
		} catch (err) {
			toast.show(friendlyError(err), 'error');
			if (isLive) await this.refresh();
			return false;
		} finally {
			this.busyId = null;
		}
	}

	accept(job: RiderJob) {
		return this.#act(
			job,
			() => api.acceptJob(job.id),
			() => {
				if (this.acceptBlock) return this.acceptBlock;
				this.open = this.open.filter((j) => j.id !== job.id);
				this.mine = [...this.mine, { ...job, status: 'ACCEPTED', acceptedAt: new Date().toISOString(), customer: DEMO_CUSTOMERS[job.id] }];
			},
			`รับงาน ${job.orderCode} แล้ว`
		);
	}

	release(job: RiderJob) {
		return this.#act(
			job,
			() => api.releaseJob(job.id),
			() => {
				const back: RiderJob = { ...job, status: 'PENDING', acceptedAt: undefined, customer: undefined };
				this.mine = this.mine.filter((j) => j.id !== job.id);
				this.open = [...this.open, back].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
			},
			`คืนงาน ${job.orderCode} แล้ว`
		);
	}

	pickedUp(job: RiderJob) {
		return this.#act(
			job,
			() => api.markPickedUp(job.id),
			() => {
				this.mine = this.mine.map((j) => (j.id === job.id ? { ...j, status: 'DELIVERING' } : j));
			},
			`รับของ ${job.orderCode} แล้ว`
		);
	}

	async confirm(job: RiderJob, otp: string): Promise<ConfirmResult> {
		if (this.busyId) return 'error';
		this.busyId = job.id;
		try {
			const matched = isLive ? await api.confirmDelivery(job.id, otp) : otp === DEMO_OTP;
			if (!matched) return 'wrong';
			if (isLive) {
				await this.refresh();
				void this.loadEarnings();
			} else {
				this.mine = this.mine.filter((j) => j.id !== job.id);
				this.earnings = [demoEarning(job, new Date().toISOString()), ...this.earnings];
			}
			toast.show(`ส่งมอบ ${job.orderCode} เรียบร้อย`, 'success');
			return 'ok';
		} catch (err) {
			toast.show(friendlyError(err), 'error');
			return 'error';
		} finally {
			this.busyId = null;
		}
	}

	reset() {
		this.#unsubscribe?.();
		this.#unsubscribe = null;
		if (this.#clock) clearInterval(this.#clock);
		this.#clock = null;
		if (this.#refreshTimer) clearTimeout(this.#refreshTimer);
		this.#refreshTimer = null;
		this.open = [];
		this.mine = [];
		this.earnings = [];
		this.earningsLoaded = false;
		this.loaded = false;
		this.busyId = null;
		this.#demoSeeded = false;
	}
}

export const rider = new RiderStore();

// ---------- Demo jobs ----------

const DEMO_CUSTOMERS: Record<string, { nickname: string; phone: string }> = {
	'demo-job-1': { nickname: 'มายด์', phone: '0891112222' },
	'demo-job-2': { nickname: 'ต้นกล้า', phone: '0823334444' },
	'demo-job-3': { nickname: 'ปราง', phone: '0865556666' },
	'demo-job-4': { nickname: 'บอส', phone: '0617778888' },
	'demo-job-5': { nickname: 'ฟ้า', phone: '0949990000' }
};

function storeJob(id: string, code: string, storeId: string, lines: [string, number][], dropoffName: string, payment: RiderJob['paymentMethod'], minutesAgo: number): RiderJob {
	const store = findStore(STORE_CATALOGUE, storeId)!;
	const items = lines.map(([menuId, quantity]) => {
		const m = store.menuItems.find((x) => x.id === menuId)!;
		return { name: m.name, price: m.price, quantity };
	});
	const foodTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
	return {
		id,
		orderCode: code,
		kind: 'STORE',
		storeId,
		pickupName: store.name,
		dropoffName,
		itemDetails: items.map((i) => `${i.name} ×${i.quantity}`).join(', '),
		items,
		foodTotal,
		deliveryFee: 15,
		totalPrice: foodTotal + 15,
		paymentMethod: payment,
		status: 'PENDING',
		createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString()
	};
}

function demoJobs(): RiderJob[] {
	return [
		storeJob('demo-job-4', '#KM-3107', 'kfc-04', [['kfc-04-1', 1]], 'อาคาร SIT ชั้น 1', 'PROMPTPAY', 6),
		{
			id: 'demo-job-5',
			orderCode: '#KM-3115',
			kind: 'CUSTOM',
			pickupName: 'เซเว่นหน้าหอใน มจธ.',
			dropoffName: 'หอพักชาย S5',
			itemDetails: 'นมจืด 2 กล่อง + ขนมปังโฮลวีต 1 แถว',
			items: [],
			foodTotal: 60,
			deliveryFee: 20,
			totalPrice: 80,
			paymentMethod: 'CASH',
			status: 'PENDING',
			note: 'ถ้าขนมปังหมด เอาแซนด์วิชแทนได้',
			createdAt: new Date(Date.now() - 5 * 60_000).toISOString()
		},
		storeJob('demo-job-1', '#KM-3121', 'kfc-05', [['kfc-05-4', 2]], 'อาคารเรียนรวม CB2', 'CASH', 3),
		storeJob('demo-job-2', '#KM-3124', 'kfc-03', [['kfc-03-1', 1], ['kfc-03-11', 1]], 'หอสมุด มจธ. (KMUTT Library)', 'CASH', 2),
		storeJob('demo-job-3', '#KM-3130', 'kfc-10', [['kfc-10-1', 2]], 'อาคาร LX ชั้น 1 หน้าตู้เต่าบิน', 'PROMPTPAY', 1)
	];
}

// ---------- Demo earnings ----------

function demoEarning(job: RiderJob, completedAt: string, payoutRef?: string): RiderEarning {
	return {
		id: `earning-${job.id}`,
		orderCode: job.orderCode,
		completedAt,
		pickupName: job.pickupName,
		dropoffName: job.dropoffName,
		paymentMethod: job.paymentMethod,
		foodTotal: job.foodTotal,
		deliveryFee: job.deliveryFee,
		totalPrice: job.totalPrice,
		owed: owedFor(job),
		paidOutAt: payoutRef ? completedAt : undefined,
		payoutRef
	};
}

/** Two earlier jobs: one PromptPay the team has not paid yet, one it paid yesterday */
function demoEarnings(): RiderEarning[] {
	const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
	return [
		demoEarning(storeJob('demo-done-1', '#KM-3088', 'kfc-02', [['kfc-02-1', 1]], 'อาคารเรียนรวม CB3', 'PROMPTPAY', 0), hoursAgo(2)),
		demoEarning(storeJob('demo-done-2', '#KM-3041', 'kfc-10', [['kfc-10-1', 1]], 'หอพักหญิง S6', 'PROMPTPAY', 0), hoursAgo(26), 'KBANK-DEMO-0917')
	];
}
