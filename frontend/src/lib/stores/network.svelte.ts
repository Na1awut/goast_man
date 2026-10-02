// Is the device online? (Svelte 5 runes)
// Drives the offline banner and re-reads data when the connection comes back,
// so a rider or buyer who walked through a dead spot sees the current state
// without reloading the app.
const RESTORED_MS = 2500;

class NetworkStore {
	online = $state(true);
	/** Just came back: the "back online" note is on screen */
	restored = $state(false);
	#timer: ReturnType<typeof setTimeout> | null = null;

	/** Start listening; `onBack` runs each time the connection returns. Returns the cleanup. */
	init(onBack: () => void): () => void {
		this.online = navigator.onLine;
		const goOffline = () => {
			if (this.#timer) clearTimeout(this.#timer);
			this.restored = false;
			this.online = false;
		};
		const goOnline = () => {
			if (this.online) return;
			this.online = true;
			this.restored = true;
			if (this.#timer) clearTimeout(this.#timer);
			this.#timer = setTimeout(() => (this.restored = false), RESTORED_MS);
			onBack();
		};
		window.addEventListener('offline', goOffline);
		window.addEventListener('online', goOnline);
		return () => {
			window.removeEventListener('offline', goOffline);
			window.removeEventListener('online', goOnline);
			if (this.#timer) clearTimeout(this.#timer);
		};
	}
}

export const network = new NetworkStore();
