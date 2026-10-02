// Web Push on this device (Svelte 5 runes): ask permission, subscribe with the
// team's public VAPID key, and keep the subscription saved for the signed-in user.
// Live mode only; demo mode has no server to send from.
import { env } from '$env/dynamic/public';
import { db, isLive } from '$lib/supabase';

const VAPID_KEY = env.PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? '';

type PushState = 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on';

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
			this.error = 'เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง';
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
