// A student's application to become a rider (Svelte 5 runes).
// Live: apply_rider() / my_rider_application(); the team approves in the console.
// Demo: kept in memory and stays "waiting" (there is no team to approve it).
import * as api from '$lib/api/live';
import type { RiderApplication } from '$lib/api/live';
import { friendlyError, isLive } from '$lib/supabase';

class RiderApplicationStore {
	application = $state<RiderApplication | null>(null);
	loaded = $state(false);
	submitting = $state(false);

	async load() {
		if (!isLive) {
			this.loaded = true;
			return;
		}
		try {
			this.application = await api.fetchMyRiderApplication();
		} catch {
			// Not being able to show the status must not block the profile page
			this.application = null;
		} finally {
			this.loaded = true;
		}
	}

	/** Returns an error message to show, or '' when the application was sent */
	async submit(availability: string, note: string): Promise<string> {
		if (this.submitting) return '';
		this.submitting = true;
		try {
			if (isLive) {
				await api.applyRider(availability, note);
				await this.load();
			} else {
				this.application = { id: 'demo-app', status: 'PENDING', availability, note: note || null, reviewNote: null, createdAt: new Date().toISOString(), reviewedAt: null };
			}
			return '';
		} catch (err) {
			return friendlyError(err);
		} finally {
			this.submitting = false;
		}
	}

	reset() {
		this.application = null;
		this.loaded = false;
	}
}

export const riderApplication = new RiderApplicationStore();
