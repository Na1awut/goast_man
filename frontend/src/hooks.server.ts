import type { Handle } from '@sveltejs/kit';
import { bodyFallback, headTags, seoFor } from '$lib/seo';
import { isSimulation, SIM_TITLE_PREFIX } from '$lib/sim';

/** The test site is never indexed and never claims to be the real pages (no canonical, no share tags) */
const SIM_HEAD = `<title>${SIM_TITLE_PREFIX}Goose Man</title>
		<meta name="robots" content="noindex, nofollow" />`;

// Runs at build time (prerender) for the static site: writes each page's title,
// description, canonical, Open Graph and JSON-LD into the HTML, so search engines
// and link previews get them without running the app. See lib/seo.ts.
export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) =>
			isSimulation
				? html.replace('<!--seo-->', SIM_HEAD).replace('<!--seo-body-->', '')
				: html.replace('<!--seo-->', headTags(seoFor(event.url.pathname))).replace('<!--seo-body-->', bodyFallback(event.url.pathname))
	});
