// Web Push on this device (Svelte 5 runes): ask permission, subscribe with the
// team's public VAPID key, and keep the subscription saved for the signed-in user.
// Live mode only; demo mode has no server to send from.
import { base } from '$app/paths';
import { env } from '$env/dynamic/public';
import { db, isLive } from '$lib/supabase';
import { t } from '$lib/i18n';

const VAPID_KEY = env.PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? '';

type PushState = 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on';
export type PushContext = 'buyer' | 'rider';

/** "Later" is respected: ask again after 3 days, and stop asking by itself after 3 refusals */
const SNOOZE_KEY = 'gm-push-snooze';
const SNOOZE_MS = 3 * 24 * 3600_000;
const MAX_AUTO_ASKS = 3;

function readSnooze(): { at: number; n: number } {
	try {
		const v = JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? 'null');
		if (v && typeof v.at === 'number' && typeof v.n === 'number') return v;
	} catch {
		// Storage blocked or corrupt: treat as never asked
	}
	return { at: 0, n: 0 };
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
	const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(padded);
	const out = new Uint8Array(new ArrayBuffer(raw.length));
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => !!a && a.byteLength === b.length && new Uint8Array(a).every((x, i) => x === b[i]);

/** iPhone/iPad: push works only from the Home Screen app (iOS 16.4+) */
const isIos = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
	typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

class PushStore {
	state = $state<PushState>('unsupported');
	busy = $state(false);
	error = $state('');
	/** A notification tapped before the app was ready: opened once orders have loaded */
	pendingTag = $state<string | null>(null);
	/** The "turn on notifications" sheet */
	promptOpen = $state(false);
	promptContext = $state<PushContext>('buyer');
	#autoAskedThisSession = false;

	/** Shown at all: only when this build has a key and the session is live */
	available = $derived(isLive && !!VAPID_KEY && this.state !== 'unsupported');

	async init() {
		if (typeof window === 'undefined') return;
		const tag = new URLSearchParams(window.location.search).get('push');
		if (tag !== null) {
			this.pendingTag = tag;
			const url = new URL(window.location.href);
			url.searchParams.delete('push');
			history.replaceState(history.state, '', url);
		}
		navigator.serviceWorker?.addEventListener('message', (e) => {
			if (e.data?.type === 'push-open') this.pendingTag = String(e.data.tag ?? '');
		});
		await this.refresh();
	}

	/** Worth asking by itself now: off, never refused three times, not refused in the last 3 days, once per visit */
	get canAutoAsk(): boolean {
		if (!this.available || this.state !== 'off' || this.#autoAskedThisSession) return false;
		const { at, n } = readSnooze();
		return n < MAX_AUTO_ASKS && Date.now() - at > SNOOZE_MS;
	}

	openPrompt(context: PushContext, auto = false) {
		if (auto) this.#autoAskedThisSession = true;
		this.promptContext = context;
		this.error = '';
		this.promptOpen = true;
	}

	/** Close the sheet; `later` remembers the refusal so it isn't asked again right away */
	closePrompt(later = false) {
		this.promptOpen = false;
		if (!later || this.state === 'on') return;
		try {
			localStorage.setItem(SNOOZE_KEY, JSON.stringify({ at: Date.now(), n: readSnooze().n + 1 }));
		} catch {
			// Not remembered: it may ask again next visit
		}
	}

	/** A notification made on the device itself, so the user sees what it will look like (no server involved) */
	async sendTest() {
		try {
			const reg = await navigator.serviceWorker.ready;
			await reg.showNotification('Goose Man', {
				body: t('เปิดแจ้งเตือนเรียบร้อยแล้ว นี่คือหน้าตาของข้อความที่จะได้รับ'),
				icon: `${base}/icon-192.png`,
				badge: `${base}/icon-192.png`,
				lang: 'th',
				tag: 'push-test'
			} as NotificationOptions);
		} catch {
			this.error = t('ส่งข้อความทดสอบไม่สำเร็จ');
		}
	}

	async refresh() {
		if (!isLive || !VAPID_KEY) return;
		if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
			this.state = isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
			return;
		}
		if (Notification.permission === 'denied') {
			this.state = 'blocked';
			return;
		}
		const reg = await navigator.serviceWorker.ready;
		const sub = await reg.pushManager.getSubscription();
		if (sub && !sameKey(sub.options.applicationServerKey, keyBytes(VAPID_KEY))) {
			// The team rotated the key: subscribe again with the new one
			await sub.unsubscribe().catch(() => {});
			this.state = 'off';
			if (Notification.permission === 'granted') await this.enable();
			return;
		}
		if (sub && Notification.permission === 'granted') {
			// Re-save each launch: the same phone may now be signed in as someone else
			await this.#save(sub).catch(() => {});
			this.state = 'on';
		} else {
			this.state = 'off';
		}
	}

	async enable() {
		if (this.busy) return;
		this.busy = true;
		this.error = '';
		try {
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				this.state = permission === 'denied' ? 'blocked' : 'off';
				return;
			}
			const reg = await navigator.serviceWorker.ready;
			const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_KEY) }));
			await this.#save(sub);
			this.state = 'on';
		} catch {
			this.error = t('เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง');
		} finally {
			this.busy = false;
		}
	}

	/** Stop notifications on this device (also on sign-out, so the next person doesn't get them) */
	async disable() {
		if (!isLive || !('serviceWorker' in navigator)) return;
		this.busy = true;
		try {
			const reg = await navigator.serviceWorker.getRegistration();
			const sub = await reg?.pushManager.getSubscription();
			if (sub) {
				await db().rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
				await sub.unsubscribe();
			}
			if (this.state === 'on') this.state = 'off';
		} catch {
			// Signing out must never fail because of push
		} finally {
			this.busy = false;
		}
	}

	async #save(sub: PushSubscription) {
		const json = sub.toJSON();
		const { error } = await db().rpc('save_push_subscription', { p_endpoint: sub.endpoint, p_p256dh: json.keys?.p256dh ?? '', p_auth: json.keys?.auth ?? '' });
		if (error) throw new Error(error.message);
	}
}

export const push = new PushStore();
