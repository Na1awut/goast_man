import { isSimulation } from '$lib/sim';

// Built as robots.txt. The test site tells every crawler to stay away; the real site welcomes them
// (except the team console).
export const prerender = true;

const REAL = `# Public pages are open to every crawler; the team console and app internals are not for search.
User-agent: *
Allow: /
Disallow: /admin

Sitemap: https://goose-man.tech/sitemap.xml
`;

export const GET = () =>
	new Response(isSimulation ? '# Test site: not for search\nUser-agent: *\nDisallow: /\n' : REAL, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' }
	});
