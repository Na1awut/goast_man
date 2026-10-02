import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FAQ } from './seoContent';
import { headTags, PAGES, SITE, seoFor, sitemapXml } from './seo';

describe('search metadata', () => {
	it('every page has its own title and description, within what search results show', () => {
		const titles = new Set(PAGES.map((p) => p.title));
		const descriptions = new Set(PAGES.map((p) => p.description));
		expect(titles.size).toBe(PAGES.length);
		expect(descriptions.size).toBe(PAGES.length);
		for (const p of PAGES) {
			expect(p.title.length).toBeGreaterThan(20);
			expect(p.title.length).toBeLessThanOrEqual(75);
			expect(p.description.length).toBeGreaterThan(80);
			expect(p.description.length).toBeLessThanOrEqual(260);
		}
	});

	it('writes canonical, Open Graph and valid JSON-LD for a page', () => {
		const html = headTags(seoFor('/about/'));
		expect(html).toContain(`<link rel="canonical" href="${SITE}/about/" />`);
		expect(html).toContain('property="og:image"');
		expect(html).toContain('name="robots" content="index, follow');
		const ld = /<script type="application\/ld\+json">(.*)<\/script>/.exec(html);
		const graph = JSON.parse(ld![1]);
		expect(graph['@context']).toBe('https://schema.org');
		expect(JSON.stringify(graph)).toContain('FAQPage');
	});

	it('finds a page with or without the trailing slash', () => {
		expect(seoFor('/about')?.path).toBe('/about/');
		expect(seoFor('/')?.path).toBe('/');
	});

	it('keeps everything else out of search (the app fallback, /admin, unknown paths)', () => {
		for (const path of ['/admin', '/[fallback]', '/something-else/']) {
			expect(seoFor(path)).toBeUndefined();
		}
		expect(headTags(undefined)).toContain('noindex');
	});

	it('escapes what goes into attributes and scripts', () => {
		const page = { ...PAGES[0], title: 'a "quoted" <title>', ld: [{ x: '</script><b>' }] };
		const html = headTags(page);
		expect(html).toContain('a &quot;quoted&quot; &lt;title&gt;');
		expect(html).not.toContain('</script><b>');
	});

	it('the sitemap in static/ lists exactly the pages here', () => {
		const file = readFileSync(new URL('../../static/sitemap.xml', import.meta.url), 'utf8');
		const urls = [...file.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
		expect(urls).toEqual(PAGES.map((p) => `${SITE}${p.path}`));
		expect(sitemapXml('2026-10-03')).toContain(`<loc>${SITE}/rider/</loc>`);
	});

	it('the FAQ is stated in plain words, with no invented numbers', () => {
		expect(FAQ.length).toBeGreaterThanOrEqual(8);
		for (const f of FAQ) {
			expect(f.q.length).toBeGreaterThan(5);
			expect(f.a.length).toBeGreaterThan(30);
		}
	});
});
