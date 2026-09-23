// Auth global store (Svelte 5 runes)
import type { User } from '$lib/types';

// --- State ---
let currentUser = $state<User | null>(null);
let authToken = $state<string | null>(null);

// --- Init from localStorage ---
export function initAuth() {
	if (typeof window === 'undefined') return;
	const saved = localStorage.getItem('gooseman_user');
	const token = localStorage.getItem('gooseman_token');
	if (saved && token) {
		try {
			currentUser = JSON.parse(saved);
			authToken = token;
		} catch {
			localStorage.removeItem('gooseman_user');
			localStorage.removeItem('gooseman_token');
		}
	}
}

// --- Actions ---
export function login(user: User, token: string) {
	currentUser = user;
	authToken = token;
	if (typeof window !== 'undefined') {
		localStorage.setItem('gooseman_user', JSON.stringify(user));
		localStorage.setItem('gooseman_token', token);
	}
}

export function logout() {
	currentUser = null;
	authToken = null;
	if (typeof window !== 'undefined') {
		localStorage.removeItem('gooseman_user');
		localStorage.removeItem('gooseman_token');
	}
}

// Demo login for prototype
export function demoLogin() {
	const demoUser: User = {
		id: 'u-demo-001',
		email: 'goose@mail.kmutt.ac.th',
		fullName: 'น้องมด (Demo)',
		studentId: '66130500001',
		avatarUrl: '',
		phoneNumber: '081-234-5678',
		promptPayNo: '0812345678',
		role: 'STUDENT',
		status: 'ACTIVE',
		riderRatingAvg: 4.95,
		createdAt: new Date().toISOString()
	};
	login(demoUser, 'demo-token-kmutt');
}

// --- Getters ---
export function getUser(): User | null {
	return currentUser;
}

export function getToken(): string | null {
	return authToken;
}

export function isAuthenticated(): boolean {
	return currentUser !== null && authToken !== null;
}
