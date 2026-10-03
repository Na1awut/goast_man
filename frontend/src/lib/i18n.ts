// Thai / English for the buyer app.
//
// The Thai text in the code is the key: t('เข้าสู่ระบบ') is that same Thai in Thai mode and the English
// from i18n/en.ts in English mode. A missing translation falls back to the Thai, so nothing ever shows
// as an empty label. `{name}` in the text is filled from the second argument:
//   t('ยอดชำระ {total} บาท', { total })
//
// Switching reloads the page (setLang), so the language never changes under a running screen and
// module-level constants read the right language when they are built.
// Not translated: store and menu names and descriptions (they come from the database), the legal
// pages and the rider / partner / team screens.
import { en } from './i18n/en';

export type Lang = 'th' | 'en';
const KEY = 'gm-lang';

function stored(): Lang {
	try {
		return localStorage.getItem(KEY) === 'en' ? 'en' : 'th';
	} catch {
		return 'th';
	}
}

export const lang: Lang = typeof localStorage === 'undefined' ? 'th' : stored();
export const isEnglish = lang === 'en';
/** For toLocaleString / toLocaleDateString */
export const dateLocale = isEnglish ? 'en-GB' : 'th-TH';

if (typeof document !== 'undefined') document.documentElement.lang = lang;

export function t(th: string, vars?: Record<string, string | number | null | undefined>): string {
	let text = isEnglish ? (en[th] ?? th) : th;
	if (vars) text = text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
	return text;
}

/** Remembers the choice and reloads, so every screen starts again in the new language */
export function setLang(next: Lang): void {
	if (next === lang) return;
	try {
		localStorage.setItem(KEY, next);
	} catch {
		/* storage blocked: the choice lasts until the page is closed */
	}
	location.reload();
}
