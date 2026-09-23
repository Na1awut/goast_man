// Auth global store (Svelte 5 runes)
import type { User } from '$lib/types';
import { isKmuttEmail } from '$lib/utils';

const USER_KEY = 'gooseman_user';
const TOKEN_KEY = 'gooseman_token';

/** Demo account used until Google OAuth is wired to the backend (/api/v1/auth/google) */
export const DEMO_USER: User = {
	id: 'u-demo-001',
	email: 'goose.b@mail.kmutt.ac.th',
	fullName: 'กูส บางมด',
	nickname: 'น้องกูส',
	studentId: '66070500123',
	faculty: 'คณะเทคโนโลยีสารสนเทศ (SIT)',
	avatarUrl: '',
	phoneNumber: '081-234-5678',
	promptPayNo: '081-234-5678',
	role: 'STUDENT',
	status: 'ACTIVE',
	buyerRatingAvg: 4.95,
	createdAt: '2025-08-01T00:00:00.000Z'
};

export class AuthError extends Error {}

class AuthStore {
	user = $state<User | null>(null);
	token = $state<string | null>(null);
	isAuthenticated = $derived(this.user !== null && this.token !== null);

	/** Restore a saved session. Returns true when the user is signed in. */
	init(): boolean {
		const saved = localStorage.getItem(USER_KEY);
		const token = localStorage.getItem(TOKEN_KEY);
		if (!saved || !token) return false;
		try {
			const user = JSON.parse(saved) as User;
			if (!isKmuttEmail(user.email)) throw new AuthError('invalid domain');
			this.user = user;
			this.token = token;
			return true;
		} catch {
			this.logout();
			return false;
		}
	}

	/**
	 * Simulated Google sign-in. Only KMUTT Workspace accounts are accepted;
	 * the backend enforces the same rule when verifying the ID token.
	 */
	async signInWithGoogle(email = DEMO_USER.email): Promise<User> {
		await new Promise((r) => setTimeout(r, 900));
		if (!isKmuttEmail(email)) {
			throw new AuthError('ใช้ได้เฉพาะอีเมล @kmutt.ac.th หรือ @mail.kmutt.ac.th เท่านั้น');
		}
		const user: User = { ...DEMO_USER, email };
		this.user = user;
		this.token = `demo-token-${Date.now()}`;
		localStorage.setItem(USER_KEY, JSON.stringify(user));
		localStorage.setItem(TOKEN_KEY, this.token);
		return user;
	}

	logout() {
		this.user = null;
		this.token = null;
		localStorage.removeItem(USER_KEY);
		localStorage.removeItem(TOKEN_KEY);
	}
}

export const auth = new AuthStore();
