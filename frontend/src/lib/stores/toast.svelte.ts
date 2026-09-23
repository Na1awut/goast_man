// Toast queue + notification inbox (Svelte 5 runes)
import type { AppNotification } from '$lib/types';
import { nowTime, uid } from '$lib/utils';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
	id: string;
	message: string;
	tone: ToastTone;
}

const MAX_VISIBLE = 3;

class ToastStore {
	toasts = $state<Toast[]>([]);
	notifications = $state<AppNotification[]>([]);
	inboxOpen = $state(false);
	unreadCount = $derived(this.notifications.filter((n) => !n.read).length);

	#timers = new Map<string, ReturnType<typeof setTimeout>>();

	/**
	 * Show a transient toast. Each toast owns its own timer, so a new toast
	 * never cuts an earlier one short. `notify` also records it in the bell inbox.
	 */
	show(message: string, tone: ToastTone = 'info', { duration = 3500, notify = false } = {}) {
		const toast: Toast = { id: uid('toast'), message, tone };
		this.toasts = [...this.toasts, toast].slice(-MAX_VISIBLE);
		this.#timers.set(
			toast.id,
			setTimeout(() => this.dismiss(toast.id), duration)
		);
		if (notify) {
			this.notifications = [{ id: toast.id, text: message, time: nowTime(), read: false }, ...this.notifications].slice(0, 30);
		}
	}

	dismiss(id: string) {
		const timer = this.#timers.get(id);
		if (timer) clearTimeout(timer);
		this.#timers.delete(id);
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	markAllRead() {
		this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
	}

	reset() {
		this.#timers.forEach(clearTimeout);
		this.#timers.clear();
		this.toasts = [];
		this.notifications = [];
	}
}

export const toast = new ToastStore();
