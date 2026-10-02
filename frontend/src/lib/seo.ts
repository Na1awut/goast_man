// Search and share metadata, one place for every public page.
//
// The app itself is a client-rendered SPA (one URL), so a crawler that does not
// run JavaScript sees an empty shell. hooks.server.ts therefore writes these
// tags into the static HTML at build time (prerender), for the home page and for
// the four information pages under routes/(info). Everything stated here is a
// fact from the app or from kmutt.ac.th: no invented ratings, prices or claims.
import { FAQ } from '$lib/seoContent';

export const SITE = 'https://goose-man.tech';
/** When the public copy was last checked against the app (shown on the pages and in JSON-LD): update it when you edit the copy */
export const UPDATED = '2026-10-03';
export const UPDATED_TEXT = '3 ต.ค. 2569';
export const BRAND = 'Goose Man (ห่านบางมด)';
const OG_IMAGE = `${SITE}/og-image.png`;

const KMUTT = {
	'@type': 'CollegeOrUniversity',
	name: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี',
	alternateName: ['มจธ.', 'KMUTT', "King Mongkut's University of Technology Thonburi"],
	address: {
		'@type': 'PostalAddress',
		streetAddress: '126 ถนนประชาอุทิศ',
		addressLocality: 'บางมด',
		addressRegion: 'กรุงเทพมหานคร',
		postalCode: '10140',
		addressCountry: 'TH'
	}
};

const ORGANIZATION = {
	'@type': 'Organization',
	'@id': `${SITE}/#org`,
	name: BRAND,
	alternateName: ['Goose Man', 'ห่านบางมด'],
	url: `${SITE}/`,
	logo: `${SITE}/icon-512.png`,
	description: 'แพลตฟอร์มฝากหิ้วอาหารและของในรั้ว มจธ. บางมด โดยนักศึกษา เพื่อนักศึกษา'
};

const WEBSITE = { '@type': 'WebSite', '@id': `${SITE}/#website`, name: BRAND, url: `${SITE}/`, inLanguage: 'th', publisher: { '@id': `${SITE}/#org` } };

const SERVICE = {
	'@type': 'Service',
	name: 'ฝากหิ้วอาหารและของใน มจธ. บางมด',
	serviceType: 'Campus food delivery (ฝากหิ้วอาหาร ฝากซื้อของ)',
	provider: { '@id': `${SITE}/#org` },
	areaServed: KMUTT,
	availableChannel: { '@type': 'ServiceChannel', serviceUrl: `${SITE}/` },
	offers: { '@type': 'Offer', price: '15', priceCurrency: 'THB', description: 'ค่าหิ้วเริ่มต้น 15 บาทต่อออเดอร์' }
};

const webPage = (path: string) => ({ '@type': 'WebPage', '@id': `${SITE}${path}#page`, url: `${SITE}${path}`, inLanguage: 'th', isPartOf: { '@id': `${SITE}/#website` }, about: { '@id': `${SITE}/#org` }, dateModified: UPDATED });

const crumbs = (...items: { name: string; path: string }[]) => ({
	'@type': 'BreadcrumbList',
	itemListElement: [{ name: 'Goose Man', path: '/' }, ...items].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE}${c.path}` }))
});

export interface PageSeo {
	/** URL path as served: "/" or "/about/" */
	path: string;
	title: string;
	description: string;
	keywords: string[];
	/** JSON-LD graph nodes for the page */
	ld: object[];
	/** Shown in the sitemap */
	priority: number;
}

export const PAGES: PageSeo[] = [
	{
		path: '/',
		title: 'Goose Man ห่านบางมด | แอปส่งอาหารและฝากหิ้วใน มจธ.',
		description:
			'แอปส่งอาหารใน มจธ. บางมด ฝากเพื่อนนักศึกษาหิ้วอาหารจากโรงอาหาร KFC โรงอาหารหอพัก และร้านรอบมอ ส่งถึงหน้าตึกเรียนหรือหอพัก ค่าหิ้วเริ่มต้น 15 บาท จ่ายผ่าน PromptPay รับของด้วยรหัส OTP',
		keywords: [
			'แอปส่งอาหาร มจธ.',
			'แอพส่งอาหาร มจธ.',
			'แอปสั่งอาหาร มจธ.',
			'แอพสั่งอาหาร มจธ.',
			'ฝากหิ้ว มจธ.',
			'ฝากซื้ออาหาร มจธ.',
			'สั่งอาหาร มจธ.',
			'ส่งอาหารใน มจธ.',
			'ฝากซื้อ บางมด',
			'KMUTT food delivery',
			'โรงอาหาร KFC มจธ.',
			'ห่านบางมด',
			'Goose Man'
		],
		ld: [WEBSITE, ORGANIZATION, SERVICE],
		priority: 1
	},
	{
		path: '/about/',
		title: 'แอปส่งอาหาร มจธ. ใช้ยังไง ฝากหิ้วอาหารส่งถึงหน้าตึก | Goose Man',
		description:
			'Goose Man แอปส่งอาหารและฝากหิ้วใน มจธ. บางมดคืออะไร ทำงานยังไง ขั้นตอนสั่ง ค่าหิ้ว การจ่ายด้วย PromptPay รับของด้วย OTP จุดส่งในมหาวิทยาลัย และคำถามที่พบบ่อย',
		keywords: ['แอปส่งอาหาร มจธ.', 'แอพส่งอาหาร มจธ.', 'ฝากหิ้วอาหาร มจธ.', 'สั่งอาหารส่งหน้าตึก มจธ.', 'ค่าหิ้ว 15 บาท', 'ฝากซื้อข้าว มจธ.', 'delivery ในมหาวิทยาลัย', 'KMUTT food delivery'],
		ld: [
			crumbs({ name: 'ใช้งานยังไง', path: '/about/' }),
			webPage('/about/'),
			{ '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
		],
		priority: 0.9
	},
	{
		path: '/areas/',
		title: 'จุดส่งอาหารใน มจธ. ตึก LX CB2 CB3 SIT หอ S5 S6 หอสมุด | Goose Man',
		description:
			'รับของได้ที่ไหนใน มจธ. บางมด: จุดส่งหน้าตึก LX, CB2, CB3, SIT, ตึกวิศวะ 12 ชั้น, หอสมุด, หอพักชาย S5, หอพักหญิง S6 และร้านที่หิ้วได้ จากโรงอาหาร KFC, โรงอาหารหอพัก, CB1, Green Canteen 190 ปี, เซเว่นหน้าหอใน',
		keywords: ['โรงอาหาร KFC มจธ.', 'King Mongkut\'s Food Center', 'หอพักชาย S5', 'หอพักหญิง S6', 'ตึก LX มจธ.', 'CB3 มจธ.', 'Green Canteen มจธ.', 'เซเว่นหน้าหอใน มจธ.', 'ซอยประชาอุทิศ 45'],
		ld: [crumbs({ name: 'จุดส่งและจุดรับใน มจธ.', path: '/areas/' }),
			webPage('/areas/')],
		priority: 0.8
	},
	{
		path: '/rider/',
		title: 'สมัครเป็นคนหิ้ว หารายได้พิเศษ นักศึกษา มจธ. | Goose Man',
		description:
			'นักศึกษา มจธ. หิ้วอาหารให้เพื่อนในมอ ได้ค่าหิ้วเริ่มต้นงานละ 15 บาท + ทิป ทีมโอนเข้า PromptPay หลังส่งสำเร็จ เลือกวันและเวลาว่างเองได้ ถือได้ครั้งละไม่เกิน 4 งาน',
		keywords: ['งานพิเศษ นักศึกษา มจธ.', 'หารายได้พิเศษ มจธ.', 'สมัครคนหิ้ว', 'รับจ้างหิ้วอาหาร มจธ.', 'งานพาร์ทไทม์ บางมด'],
		ld: [crumbs({ name: 'สมัครเป็นคนหิ้ว', path: '/rider/' }),
			webPage('/rider/')],
		priority: 0.7
	},
	{
		path: '/partner/',
		title: 'ลงร้านกับ Goose Man ขายอาหารให้นักศึกษา มจธ. | สำหรับร้านค้า',
		description:
			'ร้านค้าใน มจธ. และรอบมหาวิทยาลัย: รับออเดอร์จากนักศึกษาผ่านแอป จัดการเมนู ราคา รูป ตั้งเวลาเปิด-ปิดร้านอัตโนมัติ และดูยอดขาย โดยไม่ต้องมีหน้าร้านออนไลน์เอง',
		keywords: ['ลงร้านขายอาหาร มจธ.', 'ร้านค้า มจธ.', 'ร้านอาหารรอบ มจธ.', 'ระบบรับออเดอร์ร้านอาหาร', 'แอปส่งอาหาร ร้านค้า'],
		ld: [crumbs({ name: 'สำหรับร้านค้า', path: '/partner/' }),
			webPage('/partner/')],
		priority: 0.6
	}
];

const normalize = (pathname: string) => (pathname === '/' ? '/' : pathname.replace(/\/+$/, '') + '/');
export const seoFor = (pathname: string): PageSeo | undefined => PAGES.find((p) => p.path === normalize(pathname));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** JSON inside a <script>: "<" must not end the tag */
const json = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');

/** The <head> tags for a path. Unknown paths (the SPA fallback, /admin, ...) are kept out of search. */
export function headTags(page: PageSeo | undefined): string {
	if (!page) {
		return `<title>${esc(BRAND)}</title>\n<meta name="robots" content="noindex, nofollow" />`;
	}
	const url = `${SITE}${page.path}`;
	return [
		`<title>${esc(page.title)}</title>`,
		`<meta name="description" content="${esc(page.description)}" />`,
		`<meta name="keywords" content="${esc(page.keywords.join(', '))}" />`,
		`<meta name="robots" content="index, follow, max-image-preview:large" />`,
		`<link rel="canonical" href="${url}" />`,
		`<link rel="alternate" hreflang="th" href="${url}" />`,
		`<meta property="og:type" content="website" />`,
		`<meta property="og:site_name" content="${esc(BRAND)}" />`,
		`<meta property="og:locale" content="th_TH" />`,
		`<meta property="og:title" content="${esc(page.title)}" />`,
		`<meta property="og:description" content="${esc(page.description)}" />`,
		`<meta property="og:url" content="${url}" />`,
		`<meta property="og:image" content="${OG_IMAGE}" />`,
		`<meta property="og:image:width" content="1200" />`,
		`<meta property="og:image:height" content="630" />`,
		`<meta property="og:image:alt" content="Goose Man ห่านบางมด ฝากหิ้วอาหารใน มจธ." />`,
		`<meta name="twitter:card" content="summary_large_image" />`,
		`<meta name="twitter:title" content="${esc(page.title)}" />`,
		`<meta name="twitter:description" content="${esc(page.description)}" />`,
		`<meta name="twitter:image" content="${OG_IMAGE}" />`,
		`<script type="application/ld+json">${json({ '@context': 'https://schema.org', '@graph': page.ld })}</script>`
	].join('\n\t\t');
}

/**
 * What a visitor without JavaScript sees on the home page. Many AI crawlers (and some search ones) read the raw
 * HTML only, and the app itself needs JavaScript. It says what the login screen says: facts, plain words.
 */
export function bodyFallback(pathname: string): string {
	if (seoFor(pathname)?.path !== '/') return '';
	return `<noscript>
	<main style="max-width:720px;margin:0 auto;padding:24px;font-family:sans-serif;line-height:1.6">
		<h1>Goose Man (ห่านบางมด): แอปส่งอาหารและฝากหิ้วใน มจธ. บางมด</h1>
		<p>Goose Man คือแอปส่งอาหารและฝากหิ้วของในมหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี (มจธ. / KMUTT) วิทยาเขตบางมด นักศึกษาสั่งอาหารจากโรงอาหารหรือร้านรอบมอ แล้วเพื่อนนักศึกษาที่อยู่ใกล้ร้านหิ้วมาส่งถึงหน้าตึกเรียนหรือหอพัก</p>
		<ul>
			<li>ค่าหิ้วเริ่มต้น 15 บาทต่อออเดอร์ ชำระด้วย PromptPay</li>
			<li>รับของด้วยรหัส OTP 4 หลัก บอกคนหิ้วเมื่อได้ของครบเท่านั้น</li>
			<li>ใช้ได้เฉพาะนักศึกษาและบุคลากร มจธ. ที่เข้าสู่ระบบด้วยอีเมล @kmutt.ac.th หรือ @mail.kmutt.ac.th</li>
			<li>ส่งถึงอาคาร LX, CB2, CB3, SIT, ตึกวิศวะ 12 ชั้น, หอสมุด, หอพักชาย S5 และหอพักหญิง S6</li>
		</ul>
		<p>แอปนี้ต้องเปิดด้วยเบราว์เซอร์ที่เปิด JavaScript ไว้ อ่านรายละเอียดเพิ่มเติมได้ที่หน้า
			<a href="/about/">ใช้งานยังไง</a>, <a href="/areas/">จุดส่งและจุดรับใน มจธ.</a>,
			<a href="/rider/">สมัครเป็นคนหิ้ว</a> และ <a href="/partner/">สำหรับร้านค้า</a></p>
	</main>
</noscript>`;
}

/** sitemap.xml for the pages above */
export function sitemapXml(lastmod: string): string {
	const rows = PAGES.map((p) => `\t<url>\n\t\t<loc>${SITE}${p.path}</loc>\n\t\t<lastmod>${lastmod}</lastmod>\n\t\t<priority>${p.priority.toFixed(1)}</priority>\n\t</url>`);
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}
