// Small, framework-agnostic helpers shared across screens.

export function uid(prefix = 'id'): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return `${prefix}-${crypto.randomUUID()}`;
	}
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Random 4-digit string, 1000–9999 */
export function randomDigits4(): string {
	return String(Math.floor(1000 + Math.random() * 9000));
}

export function formatBaht(amount: number): string {
	return `${amount.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ฿`;
}

export function formatTime(iso: string | undefined): string {
	if (!iso) return '';
	return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
}

export function nowTime(): string {
	return formatTime(new Date().toISOString());
}

export function formatRelativeDate(iso: string): string {
	const date = new Date(iso);
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);
	const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
	if (sameDay(date, today)) return `วันนี้ ${formatTime(iso)}`;
	if (sameDay(date, yesterday)) return `เมื่อวาน ${formatTime(iso)}`;
	return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ` ${formatTime(iso)}`;
}

/** KMUTT student/staff Google Workspace domains */
const KMUTT_DOMAINS = ['kmutt.ac.th', 'mail.kmutt.ac.th'];

export function isKmuttEmail(email: string): boolean {
	const domain = email.trim().toLowerCase().split('@')[1];
	return !!domain && KMUTT_DOMAINS.includes(domain);
}

/** Rejects with Error('TIMEOUT') if `promise` has not settled within `ms` */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))]);
}

export function prefersReducedMotion(): boolean {
	return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** First Thai/Latin consonant of a name, skipping leading vowels (แก้ว → ก) */
export function initialOf(name: string): string {
	const trimmed = name.replace(/^(พี่|น้อง|นาย|นางสาว|นาง)\s*/, '').trim();
	const ch = [...trimmed].find((c) => !'เแโใไ'.includes(c));
	return (ch ?? '?').toUpperCase();
}
