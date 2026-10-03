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

/** The accounts created on the test database (supabase: scripts in TESTING_SITE.md). Emails only; the password is not in the code. */
export const TEST_ACCOUNTS: { email: string; label: string; area: 'app' | 'console' }[] = [
	{ email: 'buyer1@mail.kmutt.ac.th', label: 'ผู้ซื้อ 1', area: 'app' },
	{ email: 'buyer2@mail.kmutt.ac.th', label: 'ผู้ซื้อ 2', area: 'app' },
	{ email: 'rider1@mail.kmutt.ac.th', label: 'คนหิ้ว 1', area: 'app' },
	{ email: 'rider2@mail.kmutt.ac.th', label: 'คนหิ้ว 2', area: 'app' },
	{ email: 'shop1@example.com', label: 'ร้าน 1 (ป้าวาบ)', area: 'app' },
	{ email: 'shop2@example.com', label: 'ร้าน 2 (ครัวกรุงศรี)', area: 'app' },
	{ email: 'admin1@mail.kmutt.ac.th', label: 'Admin 1', area: 'console' },
	{ email: 'admin2@mail.kmutt.ac.th', label: 'Admin 2', area: 'console' },
	{ email: 'staff1@mail.kmutt.ac.th', label: 'Staff 1', area: 'console' }
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
