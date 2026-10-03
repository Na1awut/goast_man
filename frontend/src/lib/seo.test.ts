import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FAQ, FAQ_AREAS, FAQ_PARTNER, FAQ_RIDER } from './seoContent';
import { bodyFallback, headTags, PAGES, SITE, seoFor, sitemapXml } from './seo';

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

	it('the home page says what it is even without JavaScript, and only the home page does', () => {
		const html = bodyFallback('/');
		expect(html).toContain('<noscript>');
		expect(html).toContain('<h1>');
		expect(html).toContain('15 บาท');
		expect(html).toContain('href="/about/"');
		expect(bodyFallback('/about/')).toBe('');
		expect(bodyFallback('/admin')).toBe('');
	});

	it('info pages say when they were last updated', () => {
		const html = headTags(seoFor('/areas/'));
		expect(html).toContain('"dateModified":"2026-10-03"');
	});

	it('the FAQ is stated in plain words, with no invented numbers', () => {
		expect(FAQ.length).toBeGreaterThanOrEqual(8);
		for (const f of FAQ) {
			expect(f.q.length).toBeGreaterThan(5);
			expect(f.a.length).toBeGreaterThan(30);
		}
	});

	const types = (path: string) => {
		const html = headTags(seoFor(path));
		const graph = JSON.parse(/<script type="application\/ld\+json">(.*)<\/script>/.exec(html)![1])['@graph'] as { '@type': string }[];
		return graph.map((n) => n['@type']);
	};

	it('each page carries the structured data AI systems read for what it is', () => {
		expect(types('/')).toEqual(expect.arrayContaining(['WebSite', 'Organization', 'Service', 'WebApplication']));
		expect(types('/about/')).toEqual(expect.arrayContaining(['FAQPage', 'HowTo', 'BreadcrumbList', 'WebPage']));
		expect(types('/areas/')).toEqual(expect.arrayContaining(['ItemList', 'FAQPage']));
		expect(types('/rider/')).toContain('FAQPage');
		expect(types('/partner/')).toContain('FAQPage');
	});

	it('FAQ answers are short and quotable, and every question is asked once', () => {
		const all = [...FAQ, ...FAQ_AREAS, ...FAQ_RIDER, ...FAQ_PARTNER];
		expect(new Set(all.map((f) => f.q)).size).toBe(all.length);
		for (const f of all) {
			expect(f.q.length).toBeLessThanOrEqual(80);
			expect(f.a.length).toBeLessThanOrEqual(420);
		}
		expect(FAQ.length).toBeGreaterThanOrEqual(18);
	});
});

