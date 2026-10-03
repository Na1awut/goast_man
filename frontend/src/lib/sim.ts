// The test site. A build with PUBLIC_SIMULATION=true is a separate copy of the app
// for trying updates before they go to the real one: it never connects to the real
// database (no Supabase client is created, even if the keys are present), runs on
// the in-memory demo data, shows a banner on every page, and tells search engines
// to stay away. The real site is built without this flag and is unaffected.
//
// Set it only on the test deployment (see TESTING_SITE.md).
import { env } from '$env/dynamic/public';

export function simulationFlag(value: string | undefined | null): boolean {
	return (value ?? '').trim().toLowerCase() === 'true';
}

export const isSimulation = simulationFlag(env.PUBLIC_SIMULATION);

/**
 * The other kind of test site: connected to a separate TEST database (its own Supabase project, set through the
 * usual PUBLIC_SUPABASE_* values), where several people can sign in with test accounts, one per role, and use the
 * app for real against each other. Adds the test-account login; the real database is never named in its build.
 */
export const isTestSite = simulationFlag(env.PUBLIC_TEST_SITE);

/** Either kind of test site: banner, "[ทดสอบ]" titles, noindex */
export const isTestEnv = isSimulation || isTestSite;

/**
 * What a team member can open the test site as, from Settings in the real console. The ids are the ones the
 * test-ticket / test-login functions accept (supabase/functions/_shared/ticket.ts); there is no password anywhere.
 */
export const TEST_ROLE_CHOICES: { id: string; label: string }[] = [
	{ id: 'team', label: 'คอนโซลทีมงาน (บัญชีของคุณเอง)' },
	{ id: 'student1', label: 'ผู้ซื้อ 1' },
	{ id: 'student2', label: 'ผู้ซื้อ 2' },
	{ id: 'rider1', label: 'คนหิ้ว 1' },
	{ id: 'rider2', label: 'คนหิ้ว 2' },
	{ id: 'shop1', label: 'ร้าน 1 (ป้าวาบ)' },
	{ id: 'shop2', label: 'ร้าน 2 (ครัวกรุงศรี)' }
];

/** Where the launcher wants the app to open (the rider lands on the job board, not the buyer's home) */
export const simEntry: { screen: 'RIDER' | null } = { screen: null };

export const SIM_TITLE_PREFIX = '[ทดสอบ] ';

/** Keep "[ทดสอบ]" in front of whatever title a page sets, so a test tab is never mistaken for the real one */
export function installSimTitle(): void {
	if (!isTestEnv || typeof document === 'undefined') return;
	const fix = () => {
		if (!document.title.startsWith(SIM_TITLE_PREFIX)) document.title = SIM_TITLE_PREFIX + document.title;
	};
	fix();
	const el = document.querySelector('title');
	if (el) new MutationObserver(fix).observe(el, { childList: true, characterData: true, subtree: true });
}
