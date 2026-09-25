// Asks for the student's details the first time they are needed (first order,
// first ฝากซื้อ, rider mode) instead of right after sign-in, so anyone can look
// around the app first. Once saved they stay on the account.
import type { Screen } from '$lib/types';
import { auth } from './auth.svelte';
import { nav } from './nav.svelte';

export type GateReason = 'ORDER' | 'RIDER';

class ProfileGate {
	reason = $state<GateReason>('ORDER');
	/** Screen to open once the profile is saved; null returns to where the student was */
	#next: Screen | null = null;

	/** True when the profile is ready; otherwise opens the profile form and returns false */
	ensure(reason: GateReason, next: Screen | null = null): boolean {
		if (!auth.needsProfile) return true;
		this.reason = reason;
		this.#next = next;
		nav.go('ONBOARDING');
		return false;
	}

	/** The form was saved: back to where the student was, or on to the screen they asked for */
	done() {
		const next = this.#next;
		this.#next = null;
		nav.back();
		if (next) nav.go(next);
	}
}

export const profileGate = new ProfileGate();
