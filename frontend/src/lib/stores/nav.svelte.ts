// Screen navigation state (Svelte 5 runes)
import type { Screen, TabId } from '$lib/types';

const TAB_OF: Record<Screen, TabId | null> = {
	LOGIN: null,
	HOME: 'HOME',
	STORES: 'STORES',
	STORE_DETAIL: 'STORES',
	CUSTOM_ORDER: 'HOME',
	CHECKOUT: 'STORES',
	PAYMENT: 'STORES',
	TRACKING: 'ORDERS',
	CHAT: 'CHAT',
	SUCCESS: 'ORDERS',
	ORDERS: 'ORDERS',
	PROFILE: 'PROFILE',
	PARTNER: 'PROFILE',
	ONBOARDING: null,
	EDIT_PROFILE: 'PROFILE',
	RIDER: 'PROFILE'
};

/** Only top-level tab screens show the bottom bar; task screens get the full height for their action bar */
const NAV_SCREENS: Screen[] = ['HOME', 'STORES', 'ORDERS', 'PROFILE', 'PARTNER', 'RIDER'];

class NavStore {
	screen = $state<Screen>('LOGIN');
	history = $state<Screen[]>([]);

	activeTab = $derived(TAB_OF[this.screen]);
	showBottomNav = $derived(NAV_SCREENS.includes(this.screen));

	go(screen: Screen) {
		if (screen === this.screen) return;
		this.history = [...this.history, this.screen];
		this.screen = screen;
		scrollTop();
	}

	/** Replace the whole stack, e.g. from a tab bar or after checkout */
	reset(screen: Screen, history: Screen[] = screen === 'HOME' || screen === 'LOGIN' || screen === 'ONBOARDING' ? [] : ['HOME']) {
		this.history = history;
		this.screen = screen;
		scrollTop();
	}

	back() {
		const prev = this.history.at(-1);
		this.history = this.history.slice(0, -1);
		this.screen = prev ?? 'HOME';
		scrollTop();
	}
}

function scrollTop() {
	if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
}

export const nav = new NavStore();
