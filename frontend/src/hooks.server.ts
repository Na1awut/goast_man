import type { Handle } from '@sveltejs/kit';
import { headTags, seoFor } from '$lib/seo';

// Runs at build time (prerender) for the static site: writes each page's title,
// description, canonical, Open Graph and JSON-LD into the HTML, so search engines
// and link previews get them without running the app. See lib/seo.ts.
export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) => html.replace('<!--seo-->', headTags(seoFor(event.url.pathname)))
	});
