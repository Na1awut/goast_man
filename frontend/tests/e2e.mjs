import puppeteer from 'puppeteer-core';

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Screenshots go to the folder given as the first argument (none: not saved)
const OUT = process.argv[2];
if (OUT) mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL_ = process.env.E2E_URL ?? 'http://localhost:4173/';
const browser = await puppeteer.launch({
	executablePath: CHROME,
	headless: true,
	args: ['--no-sandbox']
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
// Windows "Animation effects: off" makes Chrome report reduced motion; test the default
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
const errors = [];
const logError = (text) => {
	errors.push(text);
	console.log('BROWSER ERROR ' + text);
};
page.on('console', (m) => m.type() === 'error' && logError(m.text()));
page.on('pageerror', (e) => logError('PAGEERROR ' + e.message));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
	await sleep(450);
	if (OUT) await page.screenshot({ path: `${OUT}/${name}.png` });
};
const click = async (text) => {
	const el = await page.waitForSelector(`::-p-text(${text})`, { timeout: 5000 });
	// Keep the target clear of the fixed tab bar
	await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
	await el.click();
	await sleep(350);
};
const clickSel = async (sel) => {
	await page.waitForSelector(sel, { timeout: 5000 });
	await page.click(sel);
	await sleep(350);
};
/** Click a button inside `scope` whose text contains `text` (avoids matching body copy) */
const clickIn = async (scope, text) => {
	const ok = await page.evaluate(
		(scope, text) => {
			const b = [...document.querySelectorAll(`${scope} button`)].find((el) => el.innerText.includes(text));
			b?.click();
			return !!b;
		},
		scope,
		text
	);
	if (!ok) throw new Error(`no button "${text}" in ${scope}`);
	await sleep(400);
};
const bodyHas = (t) => page.evaluate((t) => document.body.innerText.includes(t), t);

const setSelect = (optionText) =>
	page.evaluate((t) => {
		const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === t));
		sel.value = t;
		sel.dispatchEvent(new Event('change', { bubbles: true }));
	}, optionText);
const pickLabel = (text) => page.evaluate((t) => [...document.querySelectorAll('label')].find((l) => l.innerText.trim() === t)?.click(), text);
let pass = 0;
let fail = 0;
const check = async (label, cond) => {
	if (cond) pass++;
	else fail++;
	console.log((cond ? 'PASS ' : 'FAIL ') + label);
};

await page.goto(URL_, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await shot('01-login');

await clickSel('button.google-button');
await sleep(1400);
// A new account may look around first: no profile form until the first order
await check('new account goes straight to home', (await bodyHas('ขี้เกียจเดินฝ่าแดด')) && !(await bodyHas('ยินดีต้อนรับสู่ Goose Man')));
await check('greets with the Google first name', await bodyHas('สวัสดี กูส'));
await check('tab bar shown before the profile is filled in', (await page.$('nav[aria-label="เมนูหลัก"]')) !== null);
await check('no emoji in UI (home)', await page.evaluate(() => !/[\u{1F300}-\u{1FAFF}]/u.test(document.body.innerText)));
await sleep(3600);
await shot('02-home');

await clickIn('main', 'ฝากหิ้วเลย');
await check('ฝากหิ้วเลย goes to store list, not free-form order', (await bodyHas('ร้านค้าทั้งหมด')) && !(await bodyHas('ฝากซื้ออิสระ')));
await clickIn('nav', 'หน้าแรก');
await sleep(300);
await check('home tab returns from stores', await bodyHas('ขี้เกียจเดินฝ่าแดด'));

await clickIn('main', 'สั่งซ้ำ');
await check('order again → checkout with items', (await bodyHas('สรุปคำสั่งซื้อ')) && (await bodyHas('ข้าวมันไก่ทอด')));
await shot('02c-reorder-checkout');
await clickSel('button[aria-label="ย้อนกลับ"]');
await page.evaluate(() => localStorage.removeItem('gooseman_cart'));
await page.reload({ waitUntil: 'networkidle0' });
await sleep(600);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await shot('02b-home-bottom');
await page.evaluate(() => window.scrollTo(0, 0));

await clickIn('main', 'อาคาร SIT');
await check('frequent drop-off updates pill', await bodyHas('SIT ชั้น 1'));

// Stores via centre button
await clickIn('nav', 'สั่งอาหาร');
await page.type('input[type=search]', 'กะเพรา');
await sleep(400);
await check('search matches menu item', await bodyHas('พบ:'));
await shot('03-stores-search');
await page.$eval('input[type=search]', (el) => ((el.value = ''), el.dispatchEvent(new Event('input', { bubbles: true }))));
await check('only zones with stores are offered', (await bodyHas('KFC (หลัก)')) && !(await page.evaluate(() => [...document.querySelectorAll('[role=tablist] button')].some((b) => b.innerText.includes('หอพัก')))));

// Store detail (real KFC stall): menu photos, category filter, favourite
await click('Dino Papa EXPRESS');
await check('menu items have photos', await page.evaluate(() => [...document.querySelectorAll('main ul li img')].some((img) => img.src.includes('images.unsplash.com'))));
await check('no made-up rating on a new store', await bodyHas('ร้านใหม่ในแอป'));
await clickSel('button[aria-label="เพิ่ม ข้าวไก่ทอดเกาหลี"]');
await clickIn('[role=tablist]', 'ไอศกรีม');
await check('menu category filter', (await bodyHas('ไอศกรีมถ้วยเล็ก')) && !(await bodyHas('กิมจิ')));
await clickIn('[role=tablist]', 'ไอศกรีม');
await clickSel('button[aria-label="บันทึกเป็นร้านโปรด"]');
await check('favorite toggles', (await page.$('button[aria-label="นำออกจากร้านโปรด"]')) !== null && (await bodyHas('บันทึกเป็นร้านโปรดแล้ว')));
await page.evaluate(() => window.scrollTo(0, 0));
await shot('04-store-detail');

// Switch store, then order one dish in both sizes (ธรรมดา 40 + พิเศษ 50)
await clickSel('button[aria-label="ย้อนกลับ"]');
await click('ร้านข้าวมันไก่ & ข้าวหมกไก่');
await check('cross-store warning banner', await bodyHas('ตะกร้ามีของจาก'));
await check('two-size dish shows both prices', (await bodyHas('ธรรมดา')) && (await bodyHas('พิเศษ')));
await clickSel('button[aria-label="เพิ่ม ข้าวมันไก่ทอด (ธรรมดา)"]');
await check('switch-store toast', await bodyHas('ถูกนำออกจากตะกร้า'));
await clickSel('button[aria-label="เพิ่ม ข้าวมันไก่ทอด (พิเศษ)"]');
await check('cart holds both sizes: 2 items, 90 ฿', await bodyHas('2 รายการ | 90 ฿'));
await shot('05-store-sizes');

// Checkout: 40 + 50 + 15 = 105; GOOSEFREE → 90
await click('ดูตะกร้าสินค้า');
await check('checkout lists the พิเศษ line', await bodyHas('ข้าวมันไก่ทอด (พิเศษ)'));
await check('checkout net 105', await bodyHas('105 ฿'));
await page.type('input[aria-label="โค้ดส่วนลด"]', 'wrongcode');
await click('ใช้โค้ด');
await check('invalid promo message', await bodyHas('ไม่พบโค้ด'));
await page.$eval('input[aria-label="โค้ดส่วนลด"]', (el) => ((el.value = ''), el.dispatchEvent(new Event('input', { bubbles: true }))));
await page.type('input[aria-label="โค้ดส่วนลด"]', 'goosefree');
await click('ใช้โค้ด');
await check('GOOSEFREE applied, net 90', await bodyHas('สั่งอาหารและหาเพื่อนหิ้ว (90 ฿)'));
await shot('06-checkout');
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await shot('06b-checkout-bottom');

// First order: the profile form comes up once, then back to the same checkout
await check('checkout asks for buyer details once', await bodyHas('กรอกข้อมูลผู้สั่ง (ครั้งเดียว)'));
await click('สั่งอาหารและหาเพื่อนหิ้ว');
await sleep(400);
await check('first order opens the profile form', (await bodyHas('ก่อนสั่งครั้งแรก')) && (await bodyHas('ครั้งต่อไปไม่ต้องกรอกอีก')));
await check('nickname prefilled from Google name', await page.$eval('input[autocomplete="nickname"]', (i) => i.value === 'กูส'));
await check('drop-off is not asked in the profile form', !(await bodyHas('ส่งของไปที่ไหนบ่อยที่สุด')));
await shot('06c-first-order-profile');
await click('บันทึกแล้วไปต่อ');
await check('profile form validates', (await bodyHas('เบอร์มือถือ 10 หลัก')) && (await bodyHas('ต้องยอมรับเงื่อนไข')) && (await bodyHas('เลือกชั้นปี')));
await check('tab bar hidden on the profile form', (await page.$('nav[aria-label="เมนูหลัก"]')) === null);
await page.type('input[autocomplete="tel-national"]', '0812345678');
await check('phone formats as typed', await page.$eval('input[autocomplete="tel-national"]', (i) => i.value === '081-234-5678'));
await pickLabel('ปี 3');
await setSelect('คณะเทคโนโลยีสารสนเทศ (SIT)');
await page.type('input[placeholder="เช่น 66070500123"]', '66070500123');
await click('ใช้เบอร์เดียวกัน');
await clickIn('main', 'นโยบายความเป็นส่วนตัว');
await check('privacy notice opens from consent', await bodyHas('สิทธิ์ของคุณตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล'));
await page.keyboard.press('Escape');
await sleep(300);
await page.click('main input[type=checkbox]');
await click('บันทึกแล้วไปต่อ');
await sleep(600);
await check('back on the same checkout, cart kept', (await bodyHas('สรุปคำสั่งซื้อ')) && (await bodyHas('สั่งอาหารและหาเพื่อนหิ้ว (90 ฿)')));
await check('buyer details now fixed to the account', (await bodyHas('กูส · 081-234-5678')) && (await bodyHas('ผูกกับบัญชี')) && !(await bodyHas('กรอกข้อมูลผู้สั่ง (ครั้งเดียว)')));
await shot('06d-checkout-with-buyer');

// PromptPay page
await click('สั่งอาหารและหาเพื่อนหิ้ว');
await sleep(1200);
await check('payment page countdown', await page.evaluate(() => /09:5\d/.test(document.body.innerText)));
await check('payment amount 90.00', await bodyHas('90.00 ฿'));
await shot('07-payment');
await click('ยืนยันการชำระเงินและค้นหาเพื่อนหิ้ว');
await sleep(1600);
await check('tracking pending', await bodyHas('กำลังหาเพื่อนรับหิ้ว'));
await check('cart cleared after payment', !(await page.evaluate(() => localStorage.getItem('gooseman_cart'))));
await check('placed order keeps the พิเศษ size', await bodyHas('ข้าวมันไก่ทอด (พิเศษ)'));
await shot('08-tracking-pending');

await sleep(3000);
await check('rider accepted at ~3s', await bodyHas('รหัส OTP ปิดงานส่งของ'));
await shot('09-tracking-accepted');

// Chat
await clickSel('button[aria-label^="แชทกับ"]');
await check('bottom nav hidden on chat', (await page.$('nav[aria-label="เมนูหลัก"]')) === null);
await click('มาถึงรึยังครับ?');
await sleep(500);
await check('typing indicator', await bodyHas('กำลังพิมพ์'));
await sleep(2000);
await check('auto reply', await bodyHas('อีกประมาณ 2-3 นาที'));
await shot('10-chat');
await sleep(500);
await clickSel('button[aria-label="ย้อนกลับ"]');
await check('back from chat returns to tracking', await bodyHas('รหัส OTP ปิดงานส่งของ'));

await sleep(3500);
await check('delivering at ~8s', await bodyHas('จำลอง: คนหิ้วกรอก OTP'));
await shot('11-tracking-delivering');
// The walk plays frame by frame: sample which frame is visible over a full gait
const seen = new Set();
for (let i = 0; i < 30; i++) {
	seen.add(await page.evaluate(() => [...document.querySelectorAll('.goose-walk img')].findIndex((im) => im.classList.contains('opacity-100'))));
	await sleep(55);
}
await check('walk cycles through all 3 frames', seen.has(0) && seen.has(1) && seen.has(2));
await clickSel('button[aria-label*="แตะเพื่อขยายเต็มจอ"]');
await check('otp fullscreen', (await page.$('[role=dialog][aria-label^="รหัส OTP"]')) !== null);
await shot('11b-otp-fullscreen');
await page.keyboard.press('Escape');
await sleep(300);
await click('จำลอง: คนหิ้วกรอก OTP สำเร็จ');
await sleep(1800);
await check('success screen', await bodyHas('ส่งมอบอาหารสำเร็จแล้ว'));
await clickSel('button[aria-label="5 ดาว"]');
await clickIn('[aria-label="ทิป"]', '+10');
await click('ตรงเวลา');
await shot('12-success');
await click('เสร็จสิ้น กลับสู่หน้าหลัก');
await check('review submitted → home', await bodyHas('ขี้เกียจเดินฝ่าแดด'));

// Orders
await clickIn('nav', 'คำสั่งซื้อ');
await clickIn('[role=tablist]', 'สำเร็จ');
await check('completed orders listed (3)', (await page.$$('main ul > li button')).length === 3);
await check('rating + tip saved (100 ฿)', await page.evaluate(() => document.querySelector('main ul > li button').innerText.includes('100 ฿')));
await shot('13-orders');

// Chat tab with no active order
await clickIn('nav', 'แชท');
await check('chat tab empty state', await bodyHas('ยังไม่มีแชทที่เปิดอยู่'));
await clickSel('button[aria-label="ย้อนกลับ"]');

// Custom order
await clickIn('nav', 'หน้าแรก');
await clickIn('main', 'เซเว่น หอใน');
await check('pickup preselected to 7-Eleven', await page.$eval('select', (s) => s.value === '7eleven-dorm'));
await click('ยืนยันและหาเพื่อนหิ้ว');
await check('custom validation shown', await bodyHas('ระบุรายการที่ต้องการ'));
await page.type('#items', 'นมจืด 2 กล่อง');
await page.type('#price', '45');
await sleep(200);
await check('custom total 65', await bodyHas('65 ฿'));
await shot('14-custom-order');
await click('ยืนยันและหาเพื่อนหิ้ว');
await sleep(600);
await check('custom → tracking', await bodyHas('กำลังหาเพื่อนรับหิ้ว'));

// Profile
await clickIn('nav', 'โปรไฟล์').catch(async () => {
	await clickSel('button[aria-label="ย้อนกลับ"]');
	await clickIn('nav', 'โปรไฟล์');
});
await shot('15-profile');
await check('profile shows faculty · year', await bodyHas('คณะเทคโนโลยีสารสนเทศ (SIT) · ปี 3'));
await clickIn('main', 'แก้ไข');
await check('edit profile skips consent (already given)', !(await bodyHas('ฉันยอมรับ')));
await page.$eval('input[autocomplete="nickname"]', (el) => ((el.value = ''), el.dispatchEvent(new Event('input', { bubbles: true }))));
await page.type('input[autocomplete="nickname"]', 'กูสซี่');
await click('บันทึกข้อมูล');
await sleep(500);
await check('edited nickname saved', await bodyHas('กูสซี่'));
await clickIn('main', 'ออกจากระบบ');
await shot('16-logout-confirm');

await page.reload({ waitUntil: 'networkidle0' });
await sleep(500);
await check('session restored on reload', await bodyHas('ขี้เกียจเดินฝ่าแดด'));
await check('no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

// ---------- Rider flow (the demo account is on the rider roster) ----------
const acceptJob = (code) =>
	page.evaluate((code) => {
		const li = [...document.querySelectorAll('main li')].find((l) => l.innerText.includes(code) && [...l.querySelectorAll('button')].some((b) => b.innerText.trim() === 'รับงาน'));
		const btn = li && [...li.querySelectorAll('button')].find((b) => b.innerText.trim() === 'รับงาน');
		btn?.click();
		return !!btn;
	}, code);
const stopKinds = () => page.$$eval('main ol > li', (lis) => lis.map((li) => (li.querySelector('p')?.innerText.trim().startsWith('รับ') ? 'P' : 'D')).join(''));
const clickInLi = (code, text) =>
	page.evaluate(
		(code, text) => {
			const li = [...document.querySelectorAll('main ol > li')].find((l) => l.innerText.includes(code) && [...l.querySelectorAll('button')].some((b) => b.innerText.includes(text)));
			const btn = li && [...li.querySelectorAll('button')].find((b) => b.innerText.includes(text));
			btn?.click();
			return !!btn;
		},
		code,
		text
	);

await clickIn('nav', 'โปรไฟล์');
await clickIn('main', 'โหมดคนหิ้ว');
await sleep(400);
await check('rider board lists open jobs', (await bodyHas('งานที่รอคนรับ')) && (await bodyHas('#KM-3121')) && (await bodyHas('5 งาน')));
await check('empty-handed rider sees nearby jobs', await bodyHas('งานใกล้คุณ'));
await shot('19-rider-board');

await check('accept first job', await acceptJob('#KM-3121'));
await sleep(500);
await check('round shows a planned route', (await bodyHas('1/4 งาน')) && (await bodyHas('ส่งครบในประมาณ')) && (await stopKinds()) === 'PD');
await check('suggestions switch to on-the-way jobs', await bodyHas('รับเพิ่มได้ ทางเดียวกัน'));
await check('accept second job', await acceptJob('#KM-3124'));
await sleep(500);
await check('both canteen pickups come before the deliveries', (await stopKinds()) === 'PPDD', await stopKinds());
await check('customer contact shown once held', await bodyHas('มายด์'));
await shot('20-rider-round');

await check('release opens a confirmation', await clickInLi('#KM-3124', 'คืนงาน'));
await sleep(300);
await page.click('[role=dialog] button.bg-red-600');
await sleep(500);
await check('released job back on the board', (await bodyHas('1/4 งาน')) && (await stopKinds()) === 'PD');

await check('pick up the food', await clickInLi('#KM-3121', 'รับของแล้ว'));
await sleep(500);
await check('no new jobs while delivering', await bodyHas('เริ่มส่งของแล้ว ส่งรอบนี้ให้ครบก่อน'));
await check('open deliver sheet', await clickInLi('#KM-3121', 'ส่งของ'));
await sleep(300);
await page.type('[role=dialog] input', '0000');
await page.click('[role=dialog] button[type=submit]');
await sleep(400);
await check('wrong OTP refused', await bodyHas('รหัสไม่ถูกต้อง'));
await page.type('[role=dialog] input', '1234');
await shot('21-rider-otp');
await page.click('[role=dialog] button[type=submit]');
await sleep(600);
await check('right OTP completes the job', (await bodyHas('ส่งมอบ #KM-3121 เรียบร้อย')) && (await bodyHas('0/4 งาน')));
await check('no horizontal overflow (rider)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await clickIn('nav', 'หน้าแรก');

await page.setViewport({ width: 1280, height: 800 });
await sleep(400);
await shot('17-desktop-home');

// ---------- Partner flow (demo shop owner, bound to ร้านข้าวมันไก่ & ข้าวหมกไก่) ----------
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await sleep(600);
await clickSel('button.partner-button');
await sleep(1500);
await check('partner onboarding asks contact only', (await bodyHas('กรอกข้อมูลติดต่อของร้าน')) && !(await bodyHas('รหัสนักศึกษา')));
await page.type('input[autocomplete="tel-national"]', '0890001234');
await page.click('main input[type=checkbox]');
await click('เริ่มใช้งาน Goose Man');
await sleep(600);
await check('partner lands on store management', await bodyHas('จัดการร้านของฉัน'));
await page.$eval('input[maxlength="80"]', (el) => ((el.value = ''), el.dispatchEvent(new Event('input', { bubbles: true }))));
await page.type('input[maxlength="80"]', 'สูตรเด็ดประจำโรงอาหาร KFC');
await page.type('input[placeholder^="เว้นว่าง = ไม่เปิด"]', '4');
const bannerInput = await page.$('input[type=file][accept^="image/png"]');
await bannerInput.uploadFile(fileURLToPath(new URL('test-banner.png', import.meta.url)));
await sleep(300);
await click('บันทึกหน้าร้าน');
await sleep(500);
await check('storefront saved', await bodyHas('บันทึกหน้าร้านแล้ว'));
await shot('18-partner-storefront');

await click('สร้างโปร');
await page.evaluate(() => [...document.querySelectorAll('[role=dialog] label')].find((l) => l.innerText.includes('โปรร่วม Goose Man'))?.click());
await sleep(200);
await page.type('[role=dialog] input[maxlength="80"]', 'ห่านหิ้วฟรีวันศุกร์');
await page.click('[role=dialog] input[type=checkbox]');
await sleep(200);
await shot('19-partner-promo-form');
await click('ส่งให้ทีม Goose Man ตรวจ');
await sleep(400);
await check('co-promo waits for approval', await bodyHas('รอ Goose Man อนุมัติ'));
await sleep(3000);
await check('demo approval arrives', await bodyHas('แสดงในแอป') && (await bodyHas('อนุมัติโปรร่วม')));
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await shot('20-partner-promos');

// Buyer view of the same store
await click('ดูหน้าร้าน');
await sleep(500);
await check('store page shows new tagline', await bodyHas('สูตรเด็ดประจำโรงอาหาร KFC'));
await check('store page lists the co-promo', await bodyHas('ห่านหิ้วฟรีวันศุกร์'));
await check('fast lane shown', await bodyHas('Fast lane'));
await page.evaluate(() => window.scrollTo(0, 0));
await shot('21-store-partner-view');
await clickSel('button[aria-label="ย้อนกลับ"]');
await clickIn('nav', 'หน้าแรก');
await sleep(500);
await check('home shows joint promotions', await bodyHas('โปรร่วมกับ Goose Man') && (await bodyHas('ห่านหิ้วฟรีวันศุกร์')));
await page.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((e) => e.textContent.includes('โปรร่วมกับ')); h?.scrollIntoView(); window.scrollBy(0, -80); });
await shot('22-home-copromos');
console.log(`${pass} passed, ${fail} failed`);
console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
await browser.close();
process.exit(fail || errors.length ? 1 : 0);
