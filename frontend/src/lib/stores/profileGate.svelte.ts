// Asks for the student's details the first time they are needed (first order or
// ฝากซื้อ) instead of right after sign-in, so anyone can look around the app
// first. Once saved they stay on the account.
import { auth } from './auth.svelte';
import { nav } from './nav.svelte';

class ProfileGate {
	/** True when the profile is ready; otherwise opens the profile form and returns false */
	ensure(): boolean {
		if (!auth.needsProfile) return true;
		nav.go('ONBOARDING');
		return false;
	}

	/** The form was saved: back to where the student was */
	done() {
		nav.back();
	}
}

export const profileGate = new ProfileGate();
