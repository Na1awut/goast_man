// Web Push only: shows notifications sent by the send-push Edge Function and
// opens the app on a tap. No fetch handler and no caching, so a new deploy is
// never held back by an old service worker.
/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { base } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', () => void sw.skipWaiting());
sw.addEventListener('activate', (event) => event.waitUntil(sw.clients.claim()));

interface PushPayload {
	title?: string;
	body?: string;
	tag?: string | null;
}

sw.addEventListener('push', (event) => {
	let data: PushPayload = {};
	try {
		data = event.data?.json() ?? {};
	} catch {
		data = { body: event.data?.text() };
	}
	event.waitUntil(
		sw.registration.showNotification(data.title || 'Goose Man', {
			body: data.body ?? '',
			icon: `${base}/icon-192.png`,
			badge: `${base}/icon-192.png`,
			lang: 'th',
			// A newer notification about the same order or chat replaces the older one
			tag: data.tag ?? undefined,
			renotify: !!data.tag,
			data: { tag: data.tag ?? '' }
		} as NotificationOptions)
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const tag: string = event.notification.data?.tag ?? '';
	event.waitUntil(
		(async () => {
			const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const open = windows.find((w) => new URL(w.url).origin === sw.location.origin);
			if (open) {
				await open.focus();
				open.postMessage({ type: 'push-open', tag });
			} else {
				await sw.clients.openWindow(`${base}/?push=${encodeURIComponent(tag)}`);
			}
		})()
	);
});
