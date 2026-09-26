// The goose's hello right after a fresh sign-in (Svelte 5 runes).
// Not shown when the app restores a saved session on open.
const WELCOME_MS = 1800;

class WelcomeStore {
	/** Who to greet while the hello is on screen; null when hidden */
	name = $state<string | null>(null);
	#timer: ReturnType<typeof setTimeout> | null = null;

	show(name: string) {
		this.name = name;
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.hide(), WELCOME_MS);
	}

	hide() {
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = null;
		this.name = null;
	}
}

export const welcome = new WelcomeStore();
