// Auth global store (Svelte 5 runes)
import type { User } from '$lib/types';
import { isKmuttEmail } from '$lib/utils';
import { digitsOnly, needsOnboarding, TERMS_VERSION, type ProfileInput } from '$lib/profile';
import * as api from '$lib/api/live';
import { friendlyError, isLive } from '$lib/supabase';
import { catalog } from './catalog.svelte';

const USER_KEY = 'gooseman_user';
const TOKEN_KEY = 'gooseman_token';

/**
 * Demo student used when Supabase is not configured. Starts like a brand-new
 * Google account (email + name only), so the first sign-in shows onboarding.
 */
export const DEMO_USER: User = {
	id: 'u-demo-001',
	email: 'goose.b@mail.kmutt.ac.th',
	fullName: 'กูส บางมด',
	nickname: '',
	studentId: '',
	faculty: '',
	avatarUrl: '',
	phoneNumber: '',
	promptPayNo: '',
	role: 'STUDENT',
	// The demo account is on the rider roster, so โหมดคนหิ้ว can be tried out
	isRider: true,
	status: 'ACTIVE',
	buyerRatingAvg: 4.95,
	createdAt: '2025-08-01T00:00:00.000Z'
};

/**
 * Demo shop owner: not a student, bound to one store. The real stores have not
 * joined as partners, so the demo marks this one as a partner only in this
 * browser while the demo owner is signed in (see catalog.markDemoPartner).
 */
export const DEMO_PARTNER: User = {
	id: 'u-demo-partner',
	email: 'demo.shop@example.com',
	fullName: 'บัญชีร้านทดลอง',
	nickname: 'ร้านทดลอง',
	studentId: '',
	faculty: '',
	avatarUrl: '',
	phoneNumber: '',
	promptPayNo: '',
	role: 'PARTNER',
	partnerStoreId: 'kfc-05',
	status: 'ACTIVE',
	buyerRatingAvg: 5,
	createdAt: '2025-08-01T00:00:00.000Z'
};

export class AuthError extends Error {}

class AuthStore {
	user = $state<User | null>(null);
	/** Demo-mode session token; live mode keeps its session inside supabase-js */
	token = $state<string | null>(null);
	/** Error from the last sign-in attempt (e.g. a non-KMUTT Google account), shown on the login page */
	signInError = $state('');
	isAuthenticated = $derived(this.user !== null && (isLive || this.token !== null));
	isPartner = $derived(this.user?.role === 'PARTNER' && !!this.user.partnerStoreId);
	/** Signed in, but must finish the first-run profile + consent before using the app */
	needsProfile = $derived(this.user !== null && needsOnboarding(this.user));

	/** Restore a session. Resolves true when someone is signed in. */
	async init(): Promise<boolean> {
		if (isLive) {
			const redirectError = api.takeAuthRedirectError();
			if (redirectError) {
				this.signInError = friendlyError(redirectError);
				return false;
			}
			this.user = await api.currentUser();
			return this.user !== null;
		}
		const saved = localStorage.getItem(USER_KEY);
		const token = localStorage.getItem(TOKEN_KEY);
		if (!saved || !token) return false;
		try {
			const user = JSON.parse(saved) as User;
			if (user.role !== 'PARTNER' && !isKmuttEmail(user.email)) throw new AuthError('invalid domain');
			this.user = user;
			this.token = token;
			if (user.partnerStoreId) catalog.markDemoPartner(user.partnerStoreId);
			return true;
		} catch {
			await this.logout();
			return false;
		}
	}

	/**
	 * Live: redirects to Google and never resolves; the session is picked up by
	 * init() on return. Demo: signs in as the demo student or demo partner.
	 */
	async signInWithGoogle(options: { asPartner?: boolean } = {}): Promise<User> {
		if (isLive) {
			await api.signInWithGoogle(!!options.asPartner);
			return new Promise<User>(() => {});
		}
		await new Promise((r) => setTimeout(r, 900));
		const user = options.asPartner ? DEMO_PARTNER : DEMO_USER;
		if (user.role !== 'PARTNER' && !isKmuttEmail(user.email)) {
			throw new AuthError('ใช้ได้เฉพาะอีเมล @kmutt.ac.th หรือ @mail.kmutt.ac.th เท่านั้น');
		}
		this.user = user;
		this.token = `demo-token-${Date.now()}`;
		if (user.partnerStoreId) catalog.markDemoPartner(user.partnerStoreId);
		localStorage.setItem(USER_KEY, JSON.stringify(user));
		localStorage.setItem(TOKEN_KEY, this.token);
		return user;
	}

	/** Save the onboarding / edit-profile form. Throws AuthError with a message ready to show. */
	async completeProfile(input: ProfileInput): Promise<User> {
		if (!this.user) throw new AuthError('กรุณาเข้าสู่ระบบก่อน');
		const studentFields = this.user.role === 'STUDENT';
		const values = {
			nickname: input.nickname.trim(),
			phone: digitsOnly(input.phone),
			promptPay: digitsOnly(input.promptPay),
			studentId: studentFields && input.studyLevel !== 'staff' ? digitsOnly(input.studentId) : '',
			faculty: studentFields ? input.faculty.trim() : '',
			studyLevel: studentFields ? input.studyLevel : ''
		};
		if (isLive) {
			try {
				this.user = await api.completeProfile({ ...values, termsVersion: TERMS_VERSION });
			} catch (err) {
				throw new AuthError(friendlyError(err));
			}
			return this.user;
		}
		const user: User = {
			...this.user,
			nickname: values.nickname,
			phoneNumber: values.phone,
			promptPayNo: values.promptPay,
			studentId: values.studentId,
			faculty: values.faculty,
			studyLevel: values.studyLevel || undefined,
			termsVersion: TERMS_VERSION,
			consentedAt: this.user.consentedAt ?? new Date().toISOString()
		};
		this.user = user;
		localStorage.setItem(USER_KEY, JSON.stringify(user));
		return user;
	}

	async logout() {
		if (isLive) await api.signOut();
		this.user = null;
		this.token = null;
		localStorage.removeItem(USER_KEY);
		localStorage.removeItem(TOKEN_KEY);
	}
}

export const auth = new AuthStore();
