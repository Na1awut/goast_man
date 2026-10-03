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

/** Where the launcher wants the app to open (the rider lands on the job board, not the buyer's home) */
export const simEntry: { screen: 'RIDER' | null } = { screen: null };

export const SIM_TITLE_PREFIX = '[ทดสอบ] ';

/** Keep "[ทดสอบ]" in front of whatever title a page sets, so a test tab is never mistaken for the real one */
export function installSimTitle(): void {
	if (!isSimulation || typeof document === 'undefined') return;
	const fix = () => {
		if (!document.title.startsWith(SIM_TITLE_PREFIX)) document.title = SIM_TITLE_PREFIX + document.title;
	};
	fix();
	const el = document.querySelector('title');
	if (el) new MutationObserver(fix).observe(el, { childList: true, characterData: true, subtree: true });
}
