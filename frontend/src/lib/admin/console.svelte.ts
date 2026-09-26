// Team console state (Svelte 5 runes): who is signed in, which page is open,
// the 15-second refresh, menu badges and the alert sound.
import { takeAuthRedirectError } from '$lib/api/live';
import { db, friendlyError, isLive } from '$lib/supabase';
import { toast } from '$lib/stores/toast.svelte';
import { adminApi, adminError, demoSetRole, type AdminApi } from './api';
import { DEMO_ADMIN } from './demo';
import { bangkokToday } from './format';
import type { Overview, TeamMe, TeamRole } from './types';

export type Page = 'overview' | 'orders' | 'finance' | 'stores' | 'riders' | 'partners' | 'team' | 'activity' | 'settings';
export type SessionState = 'loading' | 'signed-out' | 'no-access' | 'ready';

export const PAGES: { id: Page; label: string; title: string; subtitle: string; icon: import('$lib/components/Icon.svelte').IconName; admin?: boolean }[] = [
	{ id: 'overview', label: 'ภาพรวม', title: 'ภาพรวม', subtitle: 'ดูสถานะออเดอร์ การเงิน และปัญหาที่ต้องจัดการในช่วงเที่ยงวันนี้', icon: 'home' },
	{ id: 'orders', label: 'ออเดอร์', title: 'ออเดอร์', subtitle: 'ออเดอร์ที่ต้องมีคนช่วยขึ้นก่อน กดเพื่อดูรายละเอียดและแก้ไข', icon: 'receipt' },
	{ id: 'finance', label: 'การเงิน', title: 'การเงิน', subtitle: 'โอนเงินให้คนหิ้ว คืนเงินผู้ซื้อ และประวัติการโอน', icon: 'coins' },
	{ id: 'stores', label: 'ร้านค้า', title: 'ร้านค้า', subtitle: 'เปิด/ปิดรับออเดอร์ และเมนูที่หมดวันนี้', icon: 'store' },
	{ id: 'riders', label: 'คนหิ้ว', title: 'คนหิ้ว', subtitle: 'คนหิ้วที่ผ่านการ verify และงานที่ถืออยู่ตอนนี้', icon: 'bike' },
	{ id: 'partners', label: 'Partner และโปร', title: 'Partner และโปร', subtitle: 'อนุมัติโปรร่วม และเชิญร้านเข้าร่วม', icon: 'tag' },
	{ id: 'team', label: 'ทีมงาน', title: 'ทีมงาน', subtitle: 'ใครเข้าหน้านี้ได้ และทำอะไรได้บ้าง', icon: 'users', admin: true },
	{ id: 'activity', label: 'บันทึกการทำงาน', title: 'บันทึกการทำงาน', subtitle: 'ทุกอย่างที่ทีมงานเปลี่ยนในระบบ ใครทำ เมื่อไร', icon: 'clipboard-list', admin: true },
	{ id: 'settings', label: 'ตั้งค่า', title: 'ตั้งค่า', subtitle: 'การแจ้งเตือนของเครื่องนี้ และบัญชีที่เข้าใช้งาน', icon: 'settings' }
];

const REFRESH_MS = 15_000;
const DEMO_KEY = 'gooseman_console_demo';
const SOUND_KEY = 'gooseman_console_sound';

function readRoute(): { page: Page; orderId: string | null } {
	const [, page, id] = (typeof location === 'undefined' ? '' : location.hash).replace(/^#/, '').split('/');
	const known = PAGES.some((p) => p.id === page) ? (page as Page) : 'overview';
	return { page: known, orderId: known === 'orders' && id ? decodeURIComponent(id) : null };
}

class Console {
	session = $state<SessionState>('loading');
	me = $state<TeamMe | null>(null);
	/** Email of a signed-in account that is not on the team (shown on the no-access page) */
	outsiderEmail = $state('');
	signInError = $state('');
	signingIn = $state(false);

	page = $state<Page>('overview');
	orderId = $state<string | null>(null);
	/** Day the overview and day-based order tabs look at (Bangkok "YYYY-MM-DD") */
	day = $state(bangkokToday());
	/** Search typed in the top bar; the orders page picks it up */
	search = $state('');
	/** Bumps every refresh; pages reload their data when it changes */
	tick = $state(0);
	lastUpdated = $state<Date | null>(null);
	online = $state(true);
	overview = $state<Overview | null>(null);
	overviewError = $state('');
	sound = $state(false);

	isAdmin = $derived(this.me?.role === 'ADMIN');
	badges = $derived<Partial<Record<Page, number>>>({
		orders: this.overview?.problems ?? 0,
		finance: (this.overview?.refunds_due ?? 0) + (this.overview?.payouts_due_riders ?? 0),
		partners: this.isAdmin ? (this.overview?.pending_promos ?? 0) : 0
	});

	api: AdminApi | null = null;
	#timer: ReturnType<typeof setInterval> | null = null;
	#lastProblems = -1;

	async init() {
		this.api = await adminApi();
		try {
			this.sound = localStorage.getItem(SOUND_KEY) === '1';
		} catch {
			/* storage blocked */
		}
		this.#applyRoute();
		addEventListener('hashchange', () => this.#applyRoute());
		addEventListener('online', () => (this.online = true));
		addEventListener('offline', () => (this.online = false));
		this.online = navigator.onLine;
		await this.#resolveSession();
	}

	async #resolveSession() {
		if (!isLive) {
			let signedIn = false;
			try {
				signedIn = localStorage.getItem(DEMO_KEY) === '1';
			} catch {
				/* storage blocked */
			}
			if (signedIn) await this.#enter();
			else this.session = 'signed-out';
			return;
		}
		const redirectError = takeAuthRedirectError();
		if (redirectError) this.signInError = friendlyError(redirectError);
		const {
			data: { session }
		} = await db().auth.getSession();
		if (!session) {
			this.session = 'signed-out';
			return;
		}
		await this.#enter(session.user.email ?? '');
	}

	async #enter(email = '') {
		try {
			this.me = await this.api!.me();
		} catch (err) {
			this.signInError = adminError(err);
			this.session = 'signed-out';
			return;
		}
		if (!this.me) {
			this.outsiderEmail = email;
			this.session = 'no-access';
			return;
		}
		this.session = 'ready';
		await this.refresh();
		this.#timer ??= setInterval(() => {
			if (!document.hidden) void this.refresh();
		}, REFRESH_MS);
	}

	async signIn() {
		if (this.signingIn) return;
		this.signingIn = true;
		this.signInError = '';
		if (!isLive) {
			try {
				localStorage.setItem(DEMO_KEY, '1');
			} catch {
				/* storage blocked */
			}
			await this.#enter(DEMO_ADMIN.email);
			this.signingIn = false;
			return;
		}
		const { error } = await db().auth.signInWithOAuth({
			provider: 'google',
			// Back to this same page (goastman.dev/ or /admin/) after Google
			options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } }
		});
		if (error) {
			this.signInError = friendlyError(error);
			this.signingIn = false;
		}
	}

	async signOut() {
		if (this.#timer) clearInterval(this.#timer);
		this.#timer = null;
		if (isLive) await db().auth.signOut();
		else
			try {
				localStorage.removeItem(DEMO_KEY);
			} catch {
				/* storage blocked */
			}
		this.me = null;
		this.overview = null;
		this.outsiderEmail = '';
		this.session = 'signed-out';
	}

	/** Reloads the overview (badges, sound) and tells open pages to reload */
	async refresh() {
		if (!this.api || this.session !== 'ready') return;
		try {
			this.overview = await this.api.overview(this.day);
			this.overviewError = '';
			this.lastUpdated = new Date();
			this.#alertOnNewProblems(this.overview.problems);
		} catch (err) {
			this.overviewError = adminError(err);
		}
		this.tick++;
	}

	#alertOnNewProblems(problems: number) {
		if (this.#lastProblems >= 0 && problems > this.#lastProblems && this.sound) beep();
		this.#lastProblems = problems;
	}

	setDay(day: string) {
		if (!day || day === this.day) return;
		this.day = day;
		void this.refresh();
	}

	toggleSound() {
		this.sound = !this.sound;
		try {
			localStorage.setItem(SOUND_KEY, this.sound ? '1' : '0');
		} catch {
			/* storage blocked */
		}
		if (this.sound) beep();
	}

	/** Demo mode only */
	switchDemoRole(role: TeamRole) {
		demoSetRole(role);
		if (this.me) this.me = { ...this.me, role };
		if (role === 'STAFF' && (this.page === 'team' || this.page === 'activity')) this.go('overview');
		void this.refresh();
	}

	go(page: Page, orderId: string | null = null) {
		location.hash = orderId ? `/${page}/${encodeURIComponent(orderId)}` : `/${page}`;
	}

	#applyRoute() {
		const { page, orderId } = readRoute();
		const def = PAGES.find((p) => p.id === page)!;
		// STAFF never lands on an admin-only page, even from a pasted link
		this.page = def.admin && this.me && !this.isAdmin ? 'overview' : page;
		this.orderId = orderId;
		if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
	}

	/** Confirms a finished action and refreshes the numbers */
	done(message: string) {
		toast.show(message, 'success');
		void this.refresh();
	}

	/** Runs an action, shows the outcome and refreshes; returns true on success */
	async act(run: () => Promise<unknown>, success: string): Promise<boolean> {
		try {
			await run();
			this.done(success);
			return true;
		} catch (err) {
			toast.show(adminError(err), 'error', { duration: 6000 });
			return false;
		}
	}
}

/** A short two-tone chime, drawn with Web Audio so there is no sound file to load */
function beep() {
	try {
		const ctx = new AudioContext();
		const now = ctx.currentTime;
		for (const [i, freq] of [880, 1320].entries()) {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(0.0001, now + i * 0.16);
			gain.gain.exponentialRampToValueAtTime(0.2, now + i * 0.16 + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.15);
			osc.connect(gain).connect(ctx.destination);
			osc.start(now + i * 0.16);
			osc.stop(now + i * 0.16 + 0.16);
		}
	} catch {
		/* no audio */
	}
}

export const consoleState = new Console();
