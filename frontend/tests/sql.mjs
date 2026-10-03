// Runs the real migration + seed on PGlite (Postgres in WASM) with minimal
// stand-ins for Supabase's auth/storage schemas, then exercises the rules.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const OPEN_CASES = JSON.parse(readFileSync(new URL('./open-hours-cases.json', import.meta.url), 'utf8'));
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../supabase', import.meta.url));
const db = new PGlite();

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
	cond ? pass++ : fail++;
	console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`);
};
async function expectError(label, sql, code) {
	try {
		await db.exec(sql);
		ok(label, false, '(no error raised)');
	} catch (e) {
		ok(label, !code || e.message.includes(code), code && !e.message.includes(code) ? e.message : '');
	}
}
const one = async (sql) => (await db.query(sql)).rows[0];

// ---------- Supabase stand-ins ----------
await db.exec(`
	create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
	create schema auth; create schema storage;
	create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{"provider":"google"}', created_at timestamptz not null default now());
	create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
	grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
	create table storage.buckets (id text primary key, name text, public boolean);
	create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
	alter table storage.objects enable row level security;
	create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
	create publication supabase_realtime;
	grant usage on schema public to anon, authenticated;
	alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
	alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);

// ---------- Migration + seed ----------
try {
	await db.exec(readFileSync(`${ROOT}/migrations/20260924000000_init.sql`, 'utf8'));
	ok('migration applies cleanly', true);
} catch (e) {
	ok('migration applies cleanly', false, e.message);
	process.exit(1);
}
try {
	await db.exec(readFileSync(`${ROOT}/migrations/20260925000000_profile_onboarding.sql`, 'utf8'));
	ok('onboarding migration applies cleanly', true);
} catch (e) {
	ok('onboarding migration applies cleanly', false, e.message);
	process.exit(1);
}
try {
	await db.exec(readFileSync(`${ROOT}/migrations/20260926000000_riders.sql`, 'utf8'));
	ok('riders migration applies cleanly', true);
} catch (e) {
	ok('riders migration applies cleanly', false, e.message);
	process.exit(1);
}
try {
	await db.exec(readFileSync(`${ROOT}/migrations/20260927000000_store_images.sql`, 'utf8'));
	ok('store images migration applies cleanly', true);
} catch (e) {
	ok('store images migration applies cleanly', false, e.message);
	process.exit(1);
}
try {
	await db.exec(readFileSync(`${ROOT}/migrations/20260928000000_kfc_menu_sizes.sql`, 'utf8'));
	ok('KFC + menu sizes migration applies cleanly', true);
} catch (e) {
	ok('KFC + menu sizes migration applies cleanly', false, e.message);
	process.exit(1);
}
try {
	await db.exec(readFileSync(`${ROOT}/migrations/20260929000000_profile_at_first_order.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20260930000000_promptpay_slips.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261001000000_team_console.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261002000000_client_errors.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261003000000_rider_tools.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261004000000_partner_dashboard.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261005000000_team_personal_email.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261006000000_partner_menu.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261007000000_free_delivery_team_only.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261008000000_store_discount.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261009000000_team_store_editing.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261010000000_store_recycle_bin.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261011000000_female_dorm_zone.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261012000000_cb1_zone.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261013000000_male_dorm_zone.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261014000000_payment_test_mode.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261015000000_delivery_fees.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261016000000_promo_codes.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261017000000_fix_image_permissions_and_bypass.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261018000000_menu_item_options.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261019000000_store_operating_hours.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261020000000_home_banners.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261021000000_change_store_owner.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261022000000_fix_promo_code_regression.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261023000000_support_microsoft_auth.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261024000000_require_riders_online.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261025000000_fix_rider_board_and_team_check.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261026000000_phone_privacy_chat_evidence.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261027000000_web_push.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261028000000_in_app_calls.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261029000000_security_review_fixes.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261030000000_signup_guard.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261031000000_store_open_control.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261101000000_test_pay_test_project_only.sql`, 'utf8'));
	await db.exec(readFileSync(`${ROOT}/migrations/20261102000000_slip_queue.sql`, 'utf8'));
	// The suite signs up dozens of users in seconds; the limit gets its own test below
	await db.exec(`update app_settings set value = '1000' where key = 'signup_limit_per_minute'`);
	ok('profile-at-first-order migration applies cleanly', true);
} catch (e) {
	ok('profile-at-first-order migration applies cleanly', false, e.message);
	process.exit(1);
}
await db.exec(readFileSync(`${ROOT}/seed.sql`, 'utf8'));
ok('seed loads the 12 KFC stores', Number((await one(`select count(*) n from stores where zone = 'kfc-main'`)).n) === 12);
ok('seed has no made-up promotions', Number((await one('select count(*) n from promotions')).n) === 0);
ok('seed has พิเศษ prices', Number((await one('select count(*) n from menu_items where special_price is not null')).n) > 50);
// Test fixtures only (not seed data): promotions on real stores, and one sold-out item
await db.exec(`
	insert into promotions (store_id, kind, title, min_qty, discount, free_delivery, active, approved) values
		('kfc-10', 'DEAL', 'fixture deal', 2, 10, false, true, true),
		('kfc-10', 'CO_PROMO', 'fixture co-promo', 3, 20, false, true, true),
		('kfc-05', 'CO_PROMO', 'fixture free delivery', 3, 0, true, true, true);
	update menu_items set is_available = false where id = 'kfc-04-8';
	insert into promo_codes (code, kind, amount, starts_at, max_uses, created_by) values
		('GOOSEFREE', 'FREE_DELIVERY', null, now() - interval '1 day', 9999, 'fixture');
`);

// ---------- Sign-up rules ----------
const newUser = async (email, name = 'Test User') =>
	(await one(`insert into auth.users (email, raw_user_meta_data) values ('${email}', '{"full_name":"${name}","email_verified":"true"}') returning id`)).id;

const alice = await newUser('alice@mail.kmutt.ac.th', 'Alice Wong');
const bob = await newUser('bob@kmutt.ac.th', 'Bob Rider');
const carl = await newUser('carl@mail.kmutt.ac.th', 'Carl Other');
ok('student profile created', (await one(`select role, nickname from profiles where id = '${alice}'`)).role === 'STUDENT');
// Bob and Carl run errands in the lifecycle tests below
await db.exec(`insert into rider_roster (email) values ('bob@kmutt.ac.th'), ('carl@mail.kmutt.ac.th')`);
// Orders need a rider online (NO_RIDERS_ONLINE): Bob is ready from the start
await db.exec(`insert into rider_presence (rider_id, online) values ('${bob}', true)`);
await expectError('non-KMUTT email rejected', `insert into auth.users (email) values ('eve@gmail.com')`, 'KMUTT_ONLY');

await db.exec(`insert into partner_invites (email, store_id) values ('panee.shop@example.com', 'kfc-05')`);
const panee = await newUser('Panee.Shop@example.com', 'ป้าณี');
const pp = await one(`select role, partner_store_id from profiles where id = '${panee}'`);
ok('invited partner gets PARTNER role', pp.role === 'PARTNER' && pp.partner_store_id === 'kfc-05');
ok('partner becomes store owner', (await one(`select owner_id from stores where id = 'kfc-05'`)).owner_id === panee);
ok('invite consumed', Number((await one(`select count(*) n from partner_invites`)).n) === 0);

// ---------- Acting as a user: role + JWT subject, like PostgREST ----------
const as = async (uid, fn) => {
	await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
	try {
		return await fn();
	} finally {
		await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
	}
};
// Cash by default: an unpaid PromptPay order is not a job yet (see the PromptPay section)
const placeOrder = (store, items, code = null, pay = 'CASH') =>
	one(`select place_order_at('${store}', '${JSON.stringify(items)}'::jsonb, 'sit', 1, 'โต๊ะหน้าลิฟต์', '${pay}', ${code ? `'${code}'` : 'null'}) as id`);
const orderRow = (id) => one(`select * from orders where id = '${id}'`);

// ---------- Profile is asked for at the first order, not at sign-in ----------
const cp = (args) => `select complete_profile(${args.map((v) => (v === null ? 'null' : `'${v}'`)).join(', ')})`;
/** Fill in a student's profile, as the app does before their first order */
const ready = (uid, nickname, phone, studentId) => as(uid, () => db.exec(cp([nickname, phone, null, studentId, 'คณะวิทยาศาสตร์', '2', '2026-09'])));
await as(alice, async () => {
	await expectError('no order before the profile is filled in', `select place_order_at('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1}]', 'sit', 1, '', 'CASH', null)`, 'PROFILE_REQUIRED');
	await expectError('no ฝากซื้อ before the profile is filled in', `select place_custom_order_at('เซเว่นหน้าหอใน มจธ.', 'นมจืด 2 กล่อง', 30, 'sit', 1, null)`, 'PROFILE_REQUIRED');
});
await ready(alice, 'Alice', '0811111111', '66070500101');

// ---------- Pricing (must match frontend/src/lib/pricing.ts) ----------
await as(alice, async () => {
	// kfc-10-1 ส้มปั่น 18 ฿. 2 cups: 36 food + 15 fee - 10 (DEAL min 2) = 41, no app code this time
	const o1 = await orderRow((await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 2 }])).id);
	ok('2 drinks → deal 10, total 41', o1.partner_discount === 10 && o1.code_discount === 0 && o1.total_price === 41, `total=${o1.total_price}`);

	// 3 cups: co-promo 20 beats deal 10 → 54 + 15 - 20 = 49
	const o2 = await orderRow((await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 3 }])).id);
	ok('best promotion wins (co-promo 20 > deal 10)', o2.partner_discount === 20 && o2.total_price === 49, `total=${o2.total_price}`);

	// kfc-05-4 ข้าวมันไก่ทอด 40 ฿ ×3: free-delivery co-promo (15); GOOSEFREE then waives nothing → 120
	const o3 = await orderRow((await placeOrder('kfc-05', [{ menu_item_id: 'kfc-05-4', quantity: 3 }], 'GOOSEFREE')).id);
	ok('free delivery promo + GOOSEFREE not double counted', o3.partner_discount === 15 && o3.code_discount === 0 && o3.total_price === 120, `p=${o3.partner_discount} c=${o3.code_discount} t=${o3.total_price}`);

	// ธรรมดา / พิเศษ: the พิเศษ price comes from the database too; kfc-05's free-delivery co-promo still applies
	const o4 = await orderRow((await placeOrder('kfc-05', [{ menu_item_id: 'kfc-05-4', quantity: 1 }, { menu_item_id: 'kfc-05-4', quantity: 2, special: true }])).id);
	ok('ธรรมดา + พิเศษ of one dish are separate lines', o4.food_total === 40 + 2 * 50 && o4.total_price === 140, `food=${o4.food_total} total=${o4.total_price}`);
	const lines = (await db.query(`select name, price, quantity, special from order_items where order_id = '${o4.id}' order by special`)).rows;
	ok('พิเศษ line named and priced as พิเศษ', lines.length === 2 && lines[1].special === true && lines[1].price === 50 && lines[1].name === 'ข้าวมันไก่ทอด (พิเศษ)' && lines[0].name === 'ข้าวมันไก่ทอด');
	ok('order text says พิเศษ', o4.item_details.includes('ข้าวมันไก่ทอด (พิเศษ) ×2'));
	await expectError('พิเศษ refused for a one-size item', `select place_order_at('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1,"special":true}]', 'sit', 1, '', 'CASH', null)`, 'ITEM_UNAVAILABLE');
	await expectError('duplicate พิเศษ lines refused', `select place_order_at('kfc-05', '[{"menu_item_id":"kfc-05-4","quantity":1,"special":true},{"menu_item_id":"kfc-05-4","quantity":1,"special":true}]', 'sit', 1, '', 'CASH', null)`, 'order_items_one_line');
	const mine = (await one(`select my_orders('${o4.id}') as j`)).j[0];
	ok('my_orders reports the size', mine.items.some((i) => i.special === true) && mine.items.some((i) => i.special === false));

	// Prices come from the database, whatever the client believes
	await expectError('sold-out item refused', `select place_order_at('kfc-04', '[{"menu_item_id":"kfc-04-8","quantity":1}]', 'sit', 1, '', 'CASH', null)`, 'ITEM_UNAVAILABLE');
	await expectError('item from another store refused', `select place_order_at('kfc-10', '[{"menu_item_id":"kfc-05-4","quantity":1}]', 'sit', 1, '', 'CASH', null)`, 'ITEM_UNAVAILABLE');
	await expectError('duplicate lines refused', `select place_order_at('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1},{"menu_item_id":"kfc-10-1","quantity":1}]', 'sit', 1, '', 'CASH', null)`, 'order_items_one_line');
	await expectError('quantity 0 refused', `select place_order_at('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":0}]', 'sit', 1, '', 'CASH', null)`, 'BAD_QUANTITY');
	await expectError('unknown promo code refused', `select place_order_at('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1}]', 'sit', 1, '', 'CASH', 'FREEMONEY')`, 'PROMO_INVALID');

	const c = await orderRow((await one(`select place_custom_order_at('เซเว่นหน้าหอใน', 'นมจืด 2 กล่อง', 45, 'sit', 1, '') as id`)).id);
	ok('custom order total = estimate + 20', c.total_price === 65 && c.kind === 'CUSTOM');
	await expectError('custom over 1000 refused', `select place_custom_order_at('x', 'ของเยอะ', 1500, 'sit', 1, '')`, 'BAD_PRICE');

	// Clients cannot write orders directly
	await expectError('direct insert into orders blocked by RLS', `insert into orders (order_code, kind, customer_id, pickup_name, dropoff_name, item_details, food_total, delivery_fee, total_price, payment_method) values ('#KM-0000', 'CUSTOM', '${alice}', 'a', 'b', 'c', 0, 0, 0, 'CASH')`);
	ok('OTP table returns no rows to clients', Number((await one(`select count(*) n from order_secrets`)).n) === 0);
});

// ---------- Order lifecycle, rider side, OTP ----------
const orderId = (await one(`select id from orders where customer_id = '${alice}' and total_price = 49`)).id;

await as(alice, async () => {
	await expectError('buyer off the roster cannot accept', `select accept_order('${orderId}')`, 'RIDER_ONLY');
	const mine = await one(`select my_orders('${orderId}') as j`);
	ok('no OTP shown while PENDING', mine.j[0].otp_code === null);
});
await as(bob, async () => {
	const visible = Number((await one(`select count(*) n from orders where status = 'PENDING'`)).n);
	ok('rider can browse open jobs', visible >= 1);
	await expectError('rider cannot take a job before the profile is filled in', `select accept_order('${orderId}')`, 'PROFILE_REQUIRED');
	ok('job stays open after the refused accept', (await orderRow(orderId)).status === 'PENDING');
});
await ready(bob, 'Bob', '0822222222', '66070500201');
await ready(carl, 'คาร์ล', '0833333333', '66070500301');
await as(bob, async () => {
	await db.exec(`select accept_order('${orderId}')`);
});
await as(carl, async () => {
	await expectError('second rider cannot take it', `select accept_order('${orderId}')`, 'ALREADY_TAKEN');
	ok('non-participant cannot see accepted order', Number((await one(`select count(*) n from orders where id = '${orderId}'`)).n) === 0);
});
let otp;
await as(alice, async () => {
	const j = (await one(`select my_orders('${orderId}') as j`)).j[0];
	otp = j.otp_code;
	ok('customer sees OTP once accepted', /^\d{4}$/.test(otp ?? ''));
	ok('customer sees rider summary', j.rider?.name === 'Bob' && j.rider?.jobs === 0);
	await expectError('cannot cancel after accept', `select cancel_order('${orderId}')`, 'CANNOT_CANCEL');
	await db.exec(`insert into chat_messages (order_id, sender_id, sender_role, body) values ('${orderId}', '${alice}', 'CUSTOMER', 'รออยู่หน้าลิฟต์')`);
	await expectError('cannot post as the rider', `insert into chat_messages (order_id, sender_id, sender_role, body) values ('${orderId}', '${alice}', 'RIDER', 'fake')`);
});
await as(carl, async () => {
	await expectError('outsider cannot post in chat', `insert into chat_messages (order_id, sender_id, sender_role, body) values ('${orderId}', '${carl}', 'CUSTOMER', 'hi')`);
	ok('outsider cannot read chat', Number((await one(`select count(*) n from chat_messages where order_id = '${orderId}'`)).n) === 0);
});
await as(bob, async () => {
	await db.exec(`select mark_delivering('${orderId}')`);
	await db.exec(`insert into chat_messages (order_id, sender_id, sender_role, body) values ('${orderId}', '${bob}', 'RIDER', 'ถึงจุดส่งแล้วครับ')`);
	ok('the rider answers in the chat', Number((await one(`select count(*) n from chat_messages where order_id = '${orderId}' and sender_role = 'RIDER'`)).n) === 1);
	await expectError('the rider cannot post as the buyer', `insert into chat_messages (order_id, sender_id, sender_role, body) values ('${orderId}', '${bob}', 'CUSTOMER', 'fake')`);
	const wrong = otp === '0000' ? '1111' : '0000';
	ok('wrong OTP rejected', (await one(`select confirm_delivery('${orderId}', '${wrong}') as r`)).r === false);
	ok('right OTP completes', (await one(`select confirm_delivery('${orderId}', '${otp}') as r`)).r === true);
	ok('rider reads the chat', Number((await one(`select count(*) n from chat_messages where order_id = '${orderId}'`)).n) >= 4);
});
const done = await orderRow(orderId);
ok('order COMPLETED with timestamps', done.status === 'COMPLETED' && done.accepted_at && done.delivering_at && done.completed_at);
const sys = (await db.query(`select body from chat_messages where order_id = '${orderId}' and sender_role = 'SYSTEM' order by created_at`)).rows.map((r) => r.body);
ok('system chat line per status change', sys.length === 4, JSON.stringify(sys));

// OTP brute force lock
const lockId = (await one(`select id from orders where customer_id = '${alice}' and total_price = 120`)).id;
await as(bob, async () => {
	await db.exec(`select accept_order('${lockId}'); select mark_delivering('${lockId}');`);
	for (let i = 0; i < 5; i++) await db.query(`select confirm_delivery('${lockId}', 'x${i}')`);
	await expectError('OTP locks after 5 wrong tries', `select confirm_delivery('${lockId}', '0000')`, 'OTP_LOCKED');
});

await as(alice, async () => {
	await db.exec(`select rate_order('${orderId}', 5, array['ส่งไวมาก'], 10)`);
	const r = await orderRow(orderId);
	// The tip is chosen at checkout now (round-up); rating leaves it alone
	ok('rating saved, tip left as ordered', r.rating === 5 && r.tip === 0);
	await db.exec(`select rate_order('${orderId}', 5, null, 500)`);
});
ok('tip over 100 clamped to 100', (await orderRow(orderId)).tip <= 100);

// ---------- Partner: storefront + promotions ----------
await as(panee, async () => {
	const own = (file) => `https://abc.supabase.co/storage/v1/object/public/store-banners/kfc-05/${file}`;
	const seedPhoto = (await one(`select image_url from stores where id = 'kfc-05'`)).image_url;
	const front = (banner, logo, image) => `select update_storefront('ต้มสดทุกเช้า', ${banner ? `'${banner}'` : 'null'}, 4, ${logo ? `'${logo}'` : 'null'}, ${image ? `'${image}'` : 'null'})`;
	await db.exec(front(own('b.jpg'), own('logo.png'), seedPhoto));
	const s = await one(`select tagline, banner_url, fast_lane_minutes, logo_url, image_url from stores where id = 'kfc-05'`);
	ok('partner updates own storefront', s.tagline === 'ต้มสดทุกเช้า' && s.fast_lane_minutes === 4 && s.banner_url === own('b.jpg') && s.logo_url === own('logo.png'));
	ok('unchanged admin photo is kept', s.image_url === seedPhoto);
	await expectError('outside image refused', front(own('b.jpg'), 'https://evil.example/pixel.gif', seedPhoto), 'BAD_IMAGE');
	await expectError('path escaping the store folder refused', front(own('b.jpg'), own('logo.png'), own('../kfc-10/x.jpg')), 'BAD_IMAGE');
	await expectError('another store\'s image refused', front(own('b.jpg'), 'https://abc.supabase.co/storage/v1/object/public/store-banners/kfc-10/logo.png', seedPhoto), 'BAD_IMAGE');
	await db.exec(front(null, null, own('photo.jpg')));
	const t = await one(`select banner_url, logo_url, image_url from stores where id = 'kfc-05'`);
	ok('new photo saved, banner + logo removable', t.image_url === own('photo.jpg') && t.banner_url === null && t.logo_url === null);
	await db.exec(front(null, null, null));
	ok('empty photo keeps the current one', (await one(`select image_url from stores where id = 'kfc-05'`)).image_url === own('photo.jpg'));

	const deal = await one(`insert into promotions (store_id, kind, title, discount) values ('kfc-05', 'DEAL', 'ลด 7 บาท', 7) returning approved`);
	ok('DEAL goes live immediately', deal.approved === true);
	await expectError('stores cannot make joint promotions any more', `insert into promotions (store_id, kind, title, discount) values ('kfc-05', 'CO_PROMO', 'ห่านหิ้วฟรี', 10)`, 'STORE_DEALS_ONLY');

	await expectError('partner cannot touch another store', `insert into promotions (store_id, kind, title, discount) values ('kfc-10', 'DEAL', 'แอบลด', 50)`);
	await expectError('no benefit = refused', `insert into promotions (store_id, kind, title) values ('kfc-05', 'DEAL', 'ไม่มีอะไร')`, 'promotions_has_benefit');
});

// A store runs its own deal: edit it, switch it off
await as(panee, async () => {
	await db.exec(`update promotions set discount = 8 where title = 'ลด 7 บาท'`);
	ok('editing a store deal keeps it live', (await one(`select approved from promotions where title = 'ลด 7 บาท'`)).approved === true);
	await db.exec(`update promotions set active = false where title = 'ลด 7 บาท'`);
});
await as(alice, async () => {
	ok('buyers do not see a deal the store switched off', Number((await one(`select count(*) n from promotions where title = 'ลด 7 บาท'`)).n) === 0);
	await expectError('student cannot edit storefront', `select update_storefront('x', null, null, null, null)`, 'PARTNER_ONLY');
	await expectError('student cannot change own role', `update profiles set role = 'ADMIN' where id = '${alice}'`, 'permission denied');
});

// ---------- Onboarding / profile completion ----------
await as(carl, async () => {
	await expectError('bad phone refused', cp(['คาร์ล', '12345', null, '66070500123', 'คณะวิศวกรรมศาสตร์', '3', '2026-09']), 'BAD_PHONE');
	await expectError('student needs student id', cp(['คาร์ล', '0812345678', null, null, 'คณะวิศวกรรมศาสตร์', '3', '2026-09']), 'BAD_STUDENT_ID');
	await expectError('consent required', cp(['คาร์ล', '0812345678', null, '66070500123', 'คณะวิศวกรรมศาสตร์', '3', '']), 'CONSENT_REQUIRED');
	await expectError('bad promptpay refused', cp(['คาร์ล', '0812345678', '12', '66070500123', 'คณะวิศวกรรมศาสตร์', '3', '2026-09']), 'BAD_PROMPTPAY');
	await db.exec(cp(['คาร์ล', '081-234-5678', '0812345678', '6607-0500-123', 'คณะวิศวกรรมศาสตร์', '3', '2026-09']));
	const p = await one(`select * from profiles where id = '${carl}'`);
	ok('profile completed + normalised', p.phone === '0812345678' && p.student_id === '66070500123' && p.study_level === '3' && p.consented_at && p.terms_version === '2026-09');
	await expectError('direct profile update now blocked', `update profiles set nickname = 'x' where id = '${carl}'`, 'permission denied');
});
await as(bob, async () => {
	await expectError('student id cannot be claimed twice', cp(['บ็อบ', '0899999999', null, '66070500123', 'คณะวิทยาศาสตร์', '2', '2026-09']), 'STUDENT_ID_TAKEN');
	await db.exec(cp(['บ็อบ', '0899999999', null, null, 'สำนักงานอธิการบดี', 'staff', '2026-09']));
	ok('staff may skip student id', (await one(`select student_id, study_level from profiles where id = '${bob}'`)).study_level === 'staff');
});
await as(panee, async () => {
	await db.exec(cp(['ป้าณี', '0890001234', null, 'ignored', 'ignored', 'ignored', '2026-09']));
	const p = await one(`select student_id, faculty, study_level, consented_at from profiles where id = '${panee}'`);
	ok('partner: contact only, student fields dropped', p.student_id === null && p.faculty === null && p.consented_at);
});
await as(alice, async () => {
	const j = (await one(`select my_orders('${orderId}') as j`)).j[0];
	ok('rider card shows faculty · level', j.rider.faculty === 'สำนักงานอธิการบดี · บุคลากร', j.rider.faculty);
});

// ---------- Riders: roster, capacity, one outing, release, board ----------
const dana = await newUser('dana@mail.kmutt.ac.th', 'Dana Rider');
const erin = await newUser('erin@mail.kmutt.ac.th', 'Erin Student');
await ready(dana, 'ดาน่า', '0844444444', '66070500401');
await ready(erin, 'เอริน', '0855555555', '66070500501');
await db.exec(`insert into rider_roster (email) values ('dana@mail.kmutt.ac.th')`);
const jobs = [];
await as(alice, async () => {
	for (let i = 0; i < 6; i++) jobs.push((await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }])).id);
});
const accept = (id) => `select accept_order('${id}')`;
await as(erin, async () => {
	ok('student off the roster sees no open jobs', Number((await one(`select count(*) n from orders where status = 'PENDING'`)).n) === 0);
	ok('student off the roster gets no board', (await one(`select rider_board() as b`)).b === null);
	await expectError('student off the roster cannot accept', accept(jobs[0]), 'RIDER_ONLY');
});
await as(dana, async () => {
	const own = (await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }])).id;
	await expectError('rider cannot accept own order', accept(own), 'ALREADY_TAKEN');
	const board = (await one(`select rider_board() as b`)).b;
	ok('own orders stay off the board', !board.open.some((j) => j.id === own));
	ok('board lists open jobs without customer contact', board.capacity === 4 && board.open.length >= 6 && board.open.every((j) => !('customer' in j)) && board.open[0].items?.length === 1);
	ok('rider sees open jobs through RLS', Number((await one(`select count(*) n from orders where status = 'PENDING'`)).n) >= 6);
	for (let i = 0; i < 4; i++) await db.exec(accept(jobs[i]));
	await expectError('fifth job refused (capacity 4)', accept(jobs[4]), 'RIDER_FULL');
	const mine = (await one(`select rider_board() as b`)).b.mine;
	ok('board shows my round with customer contact', mine.length === 4 && mine[0].customer.nickname === 'Alice' && 'phone' in mine[0].customer);

	await db.exec(`select release_order('${jobs[3]}')`);
	const released = await one(`select status, rider_id, accepted_at from orders where id = '${jobs[3]}'`);
	ok('released job goes back to the queue', released.status === 'PENDING' && released.rider_id === null && released.accepted_at === null);

	await db.exec(`select mark_delivering('${jobs[0]}')`);
	await expectError('no new job once delivering', accept(jobs[4]), 'FINISH_ROUND_FIRST');
	await expectError('cannot release a collected job', `select release_order('${jobs[0]}')`, 'BAD_STATE');
});
await as(erin, async () => {
	await expectError('cannot release someone else\'s job', `select release_order('${jobs[1]}')`, 'BAD_STATE');
});
const releaseLog = (await db.query(`select body from chat_messages where order_id = '${jobs[3]}' and sender_role = 'SYSTEM' order by created_at`)).rows.map((r) => r.body);
ok('buyer chat says the job was handed back', releaseLog.includes('คนหิ้วคืนงาน กำลังหาเพื่อนคนใหม่'), JSON.stringify(releaseLog));

await db.exec(`delete from rider_roster where email = 'dana@mail.kmutt.ac.th'`);
await as(dana, async () => {
	await db.exec(`select mark_delivering('${jobs[1]}')`);
	ok('removed rider can still finish jobs in hand', (await orderRow(jobs[1])).status === 'DELIVERING');
	await expectError('removed rider cannot take new jobs', accept(jobs[5]), 'RIDER_ONLY');
});

// ---------- PromptPay: slip checked by the verify-slip function, then rider payouts ----------
const asService = async (fn) => {
	await db.exec(`set role service_role;`);
	try {
		return await fn();
	} finally {
		await db.exec(`reset role;`);
	}
};
const fern = await newUser('fern@mail.kmutt.ac.th', 'Fern Rider');
await db.exec(`insert into rider_roster (email) values ('fern@mail.kmutt.ac.th')`);
await ready(fern, 'เฟิร์น', '0866666666', '66070500601');
let ppOrder, ppOrder2, cashOrder;
await as(alice, async () => {
	ppOrder = (await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 2 }], null, 'PROMPTPAY')).id;
	ppOrder2 = (await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }], null, 'PROMPTPAY')).id;
	// kfc-05-4 40 ฿ + 15 fee, less GOOSEFREE and any store promotion: the buyer hands over less than 55 in cash
	cashOrder = (await placeOrder('kfc-05', [{ menu_item_id: 'kfc-05-4', quantity: 1 }], 'GOOSEFREE')).id;
	await expectError('buyers cannot mark their own order paid', `select record_slip_payment('${ppOrder}', 'X', 1)`, 'permission denied');
});
await as(fern, async () => {
	const open = (await one(`select rider_board() as b`)).b.open.map((j) => j.id);
	ok('unpaid PromptPay order is not on the board', !open.includes(ppOrder) && open.includes(cashOrder));
	ok('riders cannot read an unpaid PromptPay order', Number((await one(`select count(*) n from orders where id = '${ppOrder}'`)).n) === 0);
	await expectError('riders cannot take an unpaid PromptPay order', accept(ppOrder), 'ALREADY_TAKEN');
});
const ppTotal = (await orderRow(ppOrder)).total_price;
const ppTotal2 = (await orderRow(ppOrder2)).total_price;
await asService(async () => {
	await expectError('slip amount must match the order', `select record_slip_payment('${ppOrder}', 'SLIP-1', ${ppTotal + 1})`, 'SLIP_AMOUNT_MISMATCH');
	await db.exec(`select record_slip_payment('${ppOrder}', 'SLIP-1', ${ppTotal})`);
	await expectError('an order cannot be paid twice', `select record_slip_payment('${ppOrder}', 'SLIP-9', ${ppTotal})`, 'ALREADY_PAID');
	await expectError('one slip cannot pay two orders', `select record_slip_payment('${ppOrder2}', 'SLIP-1', ${ppTotal2})`, 'SLIP_USED');
	await expectError('cash orders take no slip', `select record_slip_payment('${cashOrder}', 'SLIP-2', 40)`, 'ORDER_NOT_PAYABLE');
});
const paid = await orderRow(ppOrder);
ok('verified slip marks the order paid', paid.paid_at !== null && paid.slip_ref === 'SLIP-1');
ok('buyer chat says the payment arrived', Number((await one(`select count(*) n from chat_messages where order_id = '${ppOrder}' and body like 'ได้รับชำระเงินแล้ว%'`)).n) === 1);
await as(fern, async () => {
	ok('paid PromptPay order appears on the board', (await one(`select rider_board() as b`)).b.open.some((j) => j.id === ppOrder));
	await db.exec(accept(ppOrder));
	await db.exec(accept(cashOrder));
	await db.exec(`select mark_delivering('${ppOrder}')`);
	await db.exec(`select mark_delivering('${cashOrder}')`);
});
const otpOf = async (id) => (await one(`select otp_code from order_secrets where order_id = '${id}'`)).otp_code;
const [ppOtp, cashOtp] = [await otpOf(ppOrder), await otpOf(cashOrder)];
await as(fern, async () => {
	await db.exec(`select confirm_delivery('${ppOrder}', '${ppOtp}')`);
	await db.exec(`select confirm_delivery('${cashOrder}', '${cashOtp}')`);
	await expectError('riders cannot read the payout list', `select * from rider_payouts_due()`, 'permission denied');
	await expectError('riders cannot mark their own payout', `select mark_payout_paid(array['${ppOrder}']::uuid[], 'x')`, 'permission denied');
});
await asService(async () => {
	const due = (await db.query(`select * from rider_payouts_due() where rider_id = '${fern}'`)).rows;
	const pp = due.find((r) => r.order_id === ppOrder);
	const cash = due.find((r) => r.order_id === cashOrder);
	const ppRow = await orderRow(ppOrder);
	ok('the store deal on this order is the store’s money', ppRow.store_discount === ppRow.partner_discount && ppRow.store_discount > 0, JSON.stringify({ sd: ppRow.store_discount, pd: ppRow.partner_discount }));
	ok('PromptPay job: team owes the rider what they paid the stall + fee', pp?.owed === ppRow.food_total - ppRow.store_discount + ppRow.delivery_fee && pp?.collected_in_cash === 0, JSON.stringify(pp));
	const c = await orderRow(cashOrder);
	ok('cash job: team owes only the app’s discounts (the store gave its own at the counter)', cash?.collected_in_cash === c.total_price && cash?.owed === c.food_total - c.store_discount + c.delivery_fee - c.total_price && cash.owed === c.code_discount + c.partner_discount - c.store_discount, JSON.stringify(cash));
	ok('payout shows where to transfer', pp?.rider_promptpay === '0866666666' && pp?.rider_name === 'เฟิร์น');
	const n = (await one(`select mark_payout_paid(array['${ppOrder}', '${cashOrder}']::uuid[], 'KBANK-0001') as n`)).n;
	ok('recording the transfer clears it from the list', n === 2 && Number((await one(`select count(*) n from rider_payouts_due() where rider_id = '${fern}'`)).n) === 0);
});
ok('transfer reference is kept', (await orderRow(ppOrder)).payout_ref === 'KBANK-0001');

// ---------- Team console: STAFF / ADMIN roles and every admin action ----------
const tina = await newUser('tina@mail.kmutt.ac.th', 'Tina Admin');
const sam = await newUser('sam@mail.kmutt.ac.th', 'Sam Staff');
const gina = await newUser('gina@mail.kmutt.ac.th', 'Gina Rider');
await ready(tina, 'ทีน่า', '0877777777', '66070500701');
await ready(sam, 'แซม', '0888888888', '66070500801');
await ready(gina, 'จีน่า', '0899999990', '66070500901');
await db.exec(`insert into rider_roster (email) values ('gina@mail.kmutt.ac.th')`);
// The first admin is added once in the SQL Editor
await db.exec(`insert into team_members (email, role) values ('tina@mail.kmutt.ac.th', 'ADMIN')`);
const rpc = (sql) => one(`select ${sql} as j`).then((r) => r.j);
const ago = (id, minutes) => db.exec(`update orders set created_at = now() - interval '${minutes} minutes' where id = '${id}'`);
const hasFlag = (row, code) => !!row?.attention?.some((a) => a.code === code);

await as(alice, async () => {
	ok('non-member: team_me is null', (await rpc(`team_me()`)) === null);
	await expectError('non-member cannot open the console', `select admin_overview()`, 'TEAM_ONLY');
});
await db.exec(`set role anon;`);
await expectError('anonymous cannot call admin functions', `select admin_orders()`, 'permission denied');
await db.exec(`reset role;`);

await as(tina, async () => {
	ok('admin: team_me says ADMIN', (await rpc(`team_me()`))?.role === 'ADMIN');
	await db.exec(`select admin_set_member('Sam@mail.kmutt.ac.th', 'STAFF', 'lunch shift')`);
	await expectError('a team member needs a real email', `select admin_set_member('not-an-email', 'STAFF')`, 'BAD_EMAIL');
	await expectError('admins cannot change their own role', `select admin_set_member('tina@mail.kmutt.ac.th', 'STAFF')`, 'CANNOT_CHANGE_SELF');
	await expectError('admins cannot remove themselves', `select admin_remove_member('tina@mail.kmutt.ac.th')`, 'CANNOT_CHANGE_SELF');
	const team = await rpc(`admin_team()`);
	ok('team list shows both members', team.length === 2 && team.some((m) => m.email === 'sam@mail.kmutt.ac.th' && m.role === 'STAFF'));
});
await as(sam, async () => {
	ok('staff: team_me says STAFF', (await rpc(`team_me()`))?.role === 'STAFF');
	await expectError('staff cannot open the team page', `select admin_team()`, 'ADMIN_ONLY');
	await expectError('staff cannot read the activity log', `select admin_activity()`, 'ADMIN_ONLY');
	await expectError('staff cannot add riders', `select admin_add_rider('new@mail.kmutt.ac.th', 'x')`, 'ADMIN_ONLY');
});

// Orders that need a person
let cashLate, ppUnpaid, ppPaid, lockJob, requeueJob;
await as(alice, async () => {
	cashLate = (await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }])).id;
	ppUnpaid = (await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 2 }], null, 'PROMPTPAY')).id;
	ppPaid = (await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 3 }], null, 'PROMPTPAY')).id;
	// GOOSEFREE is the app's money, so the team owes the rider for this cash job
	lockJob = (await placeOrder('kfc-05', [{ menu_item_id: 'kfc-05-4', quantity: 1 }], 'GOOSEFREE')).id;
	requeueJob = (await placeOrder('kfc-05', [{ menu_item_id: 'kfc-05-3', quantity: 1 }])).id;
});
await ago(cashLate, 12);
await ago(ppUnpaid, 20);
await as(sam, async () => {
	const list = await rpc(`admin_orders('attention')`);
	const late = list.rows.find((r) => r.id === cashLate);
	const unpaid = list.rows.find((r) => r.id === ppUnpaid);
	ok('attention: cash order without a rider for 10+ min', hasFlag(late, 'UNASSIGNED') && late.attention[0].minutes >= 12, JSON.stringify(late?.attention));
	ok('attention: PromptPay unpaid for 15+ min, shown as awaiting payment', hasFlag(unpaid, 'UNPAID') && unpaid.stage === 'AWAITING_PAYMENT');
	ok('attention count matches the rows', list.counts.attention === list.rows.length && list.total === list.rows.length);
	ok('search by order code finds it', (await rpc(`admin_orders('all', null, null, null, '${late.code.replace('#', '')}')`)).rows.some((r) => r.id === cashLate));
	ok('search by buyer nickname finds orders', (await rpc(`admin_orders('all', null, null, null, 'Alice')`)).rows.length > 0);

	await expectError('manual payment needs the bank reference', `select admin_confirm_payment('${ppUnpaid}', ' ')`, 'REF_REQUIRED');
	await expectError('cash orders cannot be confirmed as PromptPay', `select admin_confirm_payment('${cashLate}', 'X')`, 'ORDER_NOT_PAYABLE');
	// STAFF may confirm by hand only when the buyer uploaded a slip the automatic check could not settle (ADMIN: any time)
	await expectError('STAFF cannot confirm a payment when the buyer uploaded no slip', `select admin_confirm_payment('${ppUnpaid}', 'KBANK-777')`, 'ADMIN_ONLY');
	await db.exec(`reset role; insert into slip_submissions (order_id, customer_id, image_path, status, error_code) select id, customer_id, 'x/y.png', 'NEEDS_REVIEW', 'STUCK' from orders where id in ('${ppUnpaid}', '${ppPaid}'); set role authenticated;`);
	await db.exec(`select admin_confirm_payment('${ppUnpaid}', 'KBANK-777')`);
	await db.exec(`select admin_confirm_payment('${ppPaid}', 'KBANK-778')`);
	await expectError('a payment cannot be confirmed twice', `select admin_confirm_payment('${ppUnpaid}', 'KBANK-779')`, 'ALREADY_PAID');
	const detail = await rpc(`admin_order('${ppUnpaid}')`);
	ok('manual payment is recorded with who confirmed it', !!detail.paid_at && detail.slip_ref === 'MANUAL:KBANK-777' && detail.payment_confirmed_by === 'แซม');
	ok('order detail shows the staff action in its activity', detail.activity.some((a) => a.action === 'PAYMENT_CONFIRMED' && a.by === 'แซม'));
});
await as(fern, async () => {
	ok('a manually confirmed order reaches the riders', (await one(`select rider_board() as b`)).b.open.some((j) => j.id === ppUnpaid));
});

// OTP lock and unlock
await as(gina, async () => {
	await db.exec(accept(lockJob));
	await db.exec(accept(requeueJob));
	await db.exec(`select mark_delivering('${lockJob}')`);
	for (let i = 0; i < 5; i++) await db.exec(`select confirm_delivery('${lockJob}', 'xxxx')`);
	await expectError('five wrong OTPs lock the job', `select confirm_delivery('${lockJob}', 'xxxx')`, 'OTP_LOCKED');
});
const lockOtp = await otpOf(lockJob);
await as(sam, async () => {
	const row = (await rpc(`admin_orders('attention')`)).rows.find((r) => r.id === lockJob);
	ok('attention: OTP locked comes first', hasFlag(row, 'OTP_LOCKED') && row.attention[0].code === 'OTP_LOCKED');
	const detail = await rpc(`admin_order('${lockJob}')`);
	ok('the panel shows failed attempts but never the OTP', detail.otp_failed === 5 && !JSON.stringify(detail).includes(`"${lockOtp}"`));
	await db.exec(`select admin_unlock_otp('${lockJob}')`);
	await expectError('unlocking an unlocked OTP is refused', `select admin_unlock_otp('${lockJob}')`, 'NOT_LOCKED');
	await expectError('requeue needs a reason', `select admin_requeue_order('${requeueJob}', '')`, 'REASON_REQUIRED');
	await db.exec(`select admin_requeue_order('${requeueJob}', 'คนหิ้วไม่ว่าง')`);
	const r = await rpc(`admin_order('${requeueJob}')`);
	ok('requeue puts the job back on the board', r.status === 'PENDING' && r.rider === null && r.activity[0].action === 'ORDER_REQUEUED');
	await expectError('only an accepted job can be requeued', `select admin_requeue_order('${lockJob}', 'x')`, 'BAD_STATE');
});
await as(gina, async () => {
	ok('after unlock the rider can close the job', (await one(`select confirm_delivery('${lockJob}', '${lockOtp}') as ok`)).ok === true);
});

// Cancel a paid order, then refund it
await as(sam, async () => {
	await expectError('cancelling needs a reason', `select admin_cancel_order('${ppPaid}', '  ')`, 'REASON_REQUIRED');
	await db.exec(`select admin_cancel_order('${ppPaid}', 'ร้านปิด')`);
	const c = await rpc(`admin_order('${ppPaid}')`);
	ok('team cancel records who, when and why', c.status === 'CANCELLED' && !!c.cancelled_at && c.cancel_reason === 'ร้านปิด' && c.cancelled_by === 'แซม');
	await expectError('a completed order cannot be cancelled', `select admin_cancel_order('${lockJob}', 'x')`, 'BAD_STATE');
	const due = await rpc(`admin_refunds_due()`);
	ok('a paid, cancelled order is due a refund', due.some((d) => d.order_id === ppPaid && d.promptpay === '0811111111'), JSON.stringify(due));
	ok('attention: refund due', hasFlag((await rpc(`admin_orders('attention')`)).rows.find((r) => r.id === ppPaid), 'REFUND_DUE'));
	await expectError('refund needs the transfer reference', `select admin_mark_refunded('${ppPaid}', '')`, 'REF_REQUIRED');
	await db.exec(`select admin_mark_refunded('${ppPaid}', 'KBANK-R1')`);
	ok('refund recorded clears it', !(await rpc(`admin_refunds_due()`)).some((d) => d.order_id === ppPaid));
	await expectError('an order cannot be refunded twice', `select admin_mark_refunded('${ppPaid}', 'KBANK-R2')`, 'BAD_STATE');
});
await as(alice, async () => {
	const own = (await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }])).id;
	await db.exec(`select cancel_order('${own}')`);
	ok('a buyer cancel is timestamped too', (await orderRow(own)).cancelled_at !== null);
});

// Rider payouts through the console
await as(sam, async () => {
	const p = (await rpc(`admin_payouts()`)).find((x) => x.rider_id === gina);
	ok('payouts list the rider with jobs and PromptPay', !!p && p.jobs === 1 && p.orders[0].order_id === lockJob && p.promptpay === '0899999990', JSON.stringify(p));
	await expectError('payout for jobs that are not owed is refused', `select admin_mark_payout('${gina}', array['${ppPaid}']::uuid[], 'x')`, 'PAYOUT_CHANGED');
	const paidOut = await rpc(`admin_mark_payout('${gina}', array['${lockJob}']::uuid[], 'KBANK-P1')`);
	ok('payout amount is computed on the server', paidOut.amount === p.owed);
	ok('paid rider leaves the list', !(await rpc(`admin_payouts()`)).some((x) => x.rider_id === gina));
	const hist = await rpc(`admin_money_history()`);
	ok('history has the payout and the refund', hist.some((h) => h.kind === 'PAYOUT' && h.ref === 'KBANK-P1' && h.by === 'แซม') && hist.some((h) => h.kind === 'REFUND' && h.ref === 'KBANK-R1'), JSON.stringify(hist));
});

// Stores and menu
await as(sam, async () => {
	await db.exec(`select admin_set_store_open('kfc-10', false)`);
	await db.exec(`select admin_set_item_available('kfc-05-3', false)`);
	const stores = await rpc(`admin_stores()`);
	ok('store list shows closed store and sold-out count', stores.find((x) => x.id === 'kfc-10').is_open === false && stores.find((x) => x.id === 'kfc-05').items_off >= 1);
	ok('store menu lists sizes and availability', (await rpc(`admin_store_menu('kfc-05')`)).some((m) => m.id === 'kfc-05-4' && m.special_price === 50));
});
await as(alice, async () => {
	await expectError('a closed store takes no orders', `select place_order_at('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1}]', 'sit', 1, '', 'CASH', null)`, 'STORE_UNAVAILABLE');
	await expectError('a sold-out item cannot be ordered', `select place_order_at('kfc-05', '[{"menu_item_id":"kfc-05-3","quantity":1}]', 'sit', 1, '', 'CASH', null)`, 'ITEM_UNAVAILABLE');
});
await as(sam, async () => {
	await db.exec(`select admin_set_store_open('kfc-10', true)`);
	await db.exec(`select admin_set_item_available('kfc-05-3', true)`);
});

// Riders (admin only)
await as(tina, async () => {
	await expectError('riders must use a KMUTT email', `select admin_add_rider('someone@gmail.com', 'x')`, 'KMUTT_ONLY');
	await db.exec(`select admin_add_rider('New.Rider@mail.kmutt.ac.th', 'ตรวจบัตร นศ. แล้ว')`);
	await expectError('a rider cannot be added twice', `select admin_add_rider('new.rider@mail.kmutt.ac.th', 'x')`, 'ALREADY_RIDER');
	const riders = await rpc(`admin_riders()`);
	ok('rider list includes someone who never signed in', riders.some((r) => r.email === 'new.rider@mail.kmutt.ac.th' && r.user_id === null && r.added_by === 'ทีน่า'));
	await expectError('removing a rider needs a reason', `select admin_remove_rider('new.rider@mail.kmutt.ac.th', '')`, 'REASON_REQUIRED');
	await db.exec(`select admin_remove_rider('new.rider@mail.kmutt.ac.th', 'ทดสอบ')`);
});

// Promotions and partners (admin only)
let coPromo;
await as(panee, async () => {
	coPromo = (await one(`insert into promotions (store_id, kind, title, min_qty, discount) values ('kfc-05', 'DEAL', 'ลดวันศุกร์', 2, 5) returning id`)).id;
});
await as(tina, async () => {
	ok('the console lists store deals as live', (await rpc(`admin_promotions()`)).find((x) => x.id === coPromo)?.state === 'LIVE');
	await db.exec(`select admin_set_promo_active('${coPromo}', false)`);
	ok('admin can switch a promo off', (await rpc(`admin_promotions()`)).find((x) => x.id === coPromo)?.state === 'OFF');
	await db.exec(`select admin_invite_partner('other@example.com', 'kfc-05')`);
	ok('handing an owned store to a new email unlinks the old owner', (await one(`select owner_id from stores where id = 'kfc-05'`)).owner_id === null);
	await db.exec(`select admin_invite_partner('panee.shop@example.com', 'kfc-05')`);
	ok('handing it back to an existing account links at once', (await one(`select owner_id from stores where id = 'kfc-05'`)).owner_id === panee);
	await db.exec(`select admin_invite_partner('Owner.One@example.com', 'kfc-01')`);
	const partners = await rpc(`admin_partners()`);
	ok('partners list owners and pending invites', partners.partners.some((x) => x.store_id === 'kfc-05') && partners.invites.some((x) => x.email === 'owner.one@example.com'));
	await db.exec(`select admin_cancel_invite('owner.one@example.com')`);
});
await as(sam, async () => {
	await expectError('staff cannot approve promotions', `select admin_review_promo('${coPromo}', true, null)`, 'ADMIN_ONLY');
	ok('staff can still see promotions', (await rpc(`admin_promotions()`)).length > 0);
});

// Overview and the activity log
await as(sam, async () => {
	const o = await rpc(`admin_overview()`);
	ok('overview counts today and its money', o.orders > 0 && o.gmv > 0 && o.is_today === true && o.stores_total === 12, JSON.stringify({ orders: o.orders, gmv: o.gmv }));
	ok('overview has 15-minute slots covering every order', o.slots.length >= 12 && o.slots[0].at <= '10:30' && o.slots.reduce((n, x) => n + x.orders, 0) === o.orders, JSON.stringify(o.slots.slice(0, 3)));
	ok('overview status counts add up', Object.values(o.status_counts).reduce((a, b) => a + b, 0) === o.orders);
	ok('overview lists riders and top stores', Array.isArray(o.riders) && o.riders.length > 0 && o.top_stores.length > 0);
});
await as(tina, async () => {
	const log = await rpc(`admin_activity()`);
	const actions = new Set(log.map((l) => l.action));
	const expected = ['PAYMENT_CONFIRMED', 'OTP_UNLOCKED', 'ORDER_REQUEUED', 'ORDER_CANCELLED', 'REFUNDED', 'PAYOUT_PAID', 'STORE_LOCKED', 'ITEM_OFF', 'RIDER_ADDED', 'PROMO_OFF', 'PARTNER_INVITED', 'MEMBER_ADDED'];
	ok('activity log records the team actions', expected.every((a) => actions.has(a)), [...actions].join(','));
	ok('activity log names who acted', log.find((l) => l.action === 'MEMBER_ADDED')?.by === 'ทีน่า');
});

// ---------- Error log: the app reports, the team reads and closes ----------
const report = (msg, source = 'app.js:1:1', app = 'buyer') =>
	db.exec(`select log_client_error('${app}', 'error', '${msg}', 'Error: ${msg}
  at f (${source})', '${source}', 'https://goose-man.tech/', 'Mozilla/5.0 (iPhone)', 'abc1234')`);
await db.exec(`set role anon;`);
await report('boom before sign-in');
await report('boom before sign-in');
await expectError('anonymous cannot read the error log', `select admin_errors()`, 'permission denied');
ok('anonymous cannot read the table directly', Number((await one(`select count(*) n from client_errors`)).n) === 0);
await db.exec(`reset role;`);
await as(alice, async () => {
	await report('boom before sign-in');
	await report('different place', 'other.js:9:9');
	await report(`it's quoted`.replace("'", "''"), 'q.js:1:1', 'console');
	await expectError('a buyer cannot read the error log', `select admin_errors()`, 'TEAM_ONLY');
});
ok('the same error is one row with a count', (await one(`select count from client_errors where message = 'boom before sign-in'`)).count === 3);
ok('the last signed-in user is kept', (await one(`select user_id from client_errors where message = 'boom before sign-in'`)).user_id === alice);
await as(bob, () => db.exec(`select log_client_error('buyer', 'error', repeat('x', 5000), repeat('y', 9000), '', repeat('u', 900), repeat('a', 900), repeat('r', 90))`));
const long = await one(`select length(message) m, length(stack) s, length(url) u, length(user_agent) a, length(release) r from client_errors where message like 'xxx%'`);
ok('long reports are trimmed', long.m === 500 && long.s === 4000 && long.u === 500 && long.a === 300 && long.r === 40, JSON.stringify(long));
await as(bob, async () => {
	for (let i = 0; i < 40; i++) await report(`flood ${i}`, `flood.js:${i}:1`);
});
ok('a flood of new errors is capped', Number((await one(`select count(*) n from client_errors`)).n) === 30);
await db.exec(`delete from client_errors where message like 'flood%'`);
await as(sam, async () => {
	const open = await rpc(`admin_errors()`);
	const boom = open.find((e) => e.message === 'boom before sign-in');
	ok('staff sees open errors with who and where', open.length === 4 && boom?.count === 3 && boom.user === 'Alice' && boom.release === 'abc1234', JSON.stringify(boom));
	ok('console errors are told apart', open.some((e) => e.app === 'console' && e.message === "it's quoted"));
	ok('error badge counts open errors', (await rpc(`admin_error_count()`)) === 4);
	await db.exec(`select admin_resolve_error(${boom.id})`);
	await expectError('an error cannot be closed twice', `select admin_resolve_error(${boom.id})`, 'BAD_STATE');
	ok('closed errors move to the fixed list', (await rpc(`admin_errors('resolved')`))[0]?.resolved_by === 'แซม' && (await rpc(`admin_error_count()`)) === 3);
});
await as(alice, () => report('boom before sign-in'));
ok('a fixed error that comes back opens a new row', Number((await one(`select count(*) n from client_errors where message = 'boom before sign-in'`)).n) === 2);
await as(tina, async () => {
	ok('closing an error is in the activity log', (await rpc(`admin_activity()`)).some((l) => l.action === 'ERROR_RESOLVED' && l.by === 'แซม'));
});

// ---------- Rider tools: ready/offline, applications, round-up tip ----------
// Ready / offline
await as(alice, () => expectError('a non-rider cannot switch on', `select set_rider_online(true)`, 'RIDER_ONLY'));
await as(bob, async () => {
	await db.exec(`select set_rider_online(true)`);
	ok('a ready rider shows on the board', (await rpc(`rider_board()`)).online === true);
});
await db.exec(`set role anon;`);
ok('anyone can see how many riders are ready', (await rpc(`riders_online()`)) === 1);
await db.exec(`reset role;`);
await as(sam, async () => {
	const r = await rpc(`admin_riders()`);
	ok('the console shows who is ready', r.find((x) => x.email === 'bob@kmutt.ac.th')?.online === true && r.find((x) => x.email === 'carl@mail.kmutt.ac.th')?.online === false);
});
await db.exec(`update rider_presence set last_seen = now() - interval '11 minutes' where rider_id = '${bob}'`);
ok('a rider not seen for 10 minutes drops out', (await rpc(`riders_online()`)) === 0);
await as(bob, () => db.exec(`select set_rider_online(true)`));
ok('opening the rider screen again counts them back', (await rpc(`riders_online()`)) === 1);
await as(bob, () => db.exec(`select set_rider_online(false)`));
ok('switching off drops out at once', (await rpc(`riders_online()`)) === 0);
await db.exec(`delete from rider_roster where email = 'bob@kmutt.ac.th'`);
await db.exec(`update rider_presence set online = true, last_seen = now() where rider_id = '${bob}'`);
ok('someone taken off the roster is never counted', (await rpc(`riders_online()`)) === 0);
await db.exec(`insert into rider_roster (email) values ('bob@kmutt.ac.th'); update rider_presence set online = true, last_seen = now() where rider_id = '${bob}'`);

// Applications
const hana = await newUser('hana@mail.kmutt.ac.th', 'Hana Student');
await as(hana, () => expectError('applying needs the profile first', `select apply_rider('จันทร์-พุธ เที่ยง', null)`, 'PROFILE_REQUIRED'));
await ready(hana, 'ฮานะ', '0866666666', '66070501001');
await as(hana, async () => {
	await expectError('availability is required', `select apply_rider('  ', null)`, 'BAD_AVAILABILITY');
	await db.exec(`select apply_rider('จันทร์-พุธ เที่ยง', 'มีจักรยาน')`);
	await expectError('one application at a time', `select apply_rider('ทุกวัน', null)`, 'APPLICATION_PENDING');
	ok('the student sees their application is waiting', (await rpc(`my_rider_application()`))?.status === 'PENDING');
});
await as(bob, () => expectError('a rider does not apply again', `select apply_rider('ทุกวัน', null)`, 'ALREADY_RIDER'));
await as(panee, () => expectError('a shop owner cannot apply', `select apply_rider('ทุกวัน', null)`, 'STUDENT_ONLY'));
let hanaApp;
await as(sam, async () => {
	const apps = await rpc(`admin_rider_applications()`);
	hanaApp = apps.find((a) => a.email === 'hana@mail.kmutt.ac.th');
	ok('staff see applications with the student details', !!hanaApp && hanaApp.nickname === 'ฮานะ' && hanaApp.student_id === '66070501001' && hanaApp.availability === 'จันทร์-พุธ เที่ยง');
	ok('the badge counts applications waiting', (await rpc(`admin_badges()`)).rider_applications === 1);
	await expectError('staff cannot approve riders', `select admin_review_rider_application('${hanaApp.id}', true, null)`, 'ADMIN_ONLY');
});
await as(tina, async () => {
	await expectError('rejecting needs a reason', `select admin_review_rider_application('${hanaApp.id}', false, ' ')`, 'REASON_REQUIRED');
	await db.exec(`select admin_review_rider_application('${hanaApp.id}', false, 'มาตรวจบัตรก่อนนะ')`);
	await expectError('a reviewed application cannot be reviewed again', `select admin_review_rider_application('${hanaApp.id}', true, null)`, 'BAD_STATE');
});
await as(hana, async () => {
	const mine = await rpc(`my_rider_application()`);
	ok('the student sees the reason for a rejection', mine.status === 'REJECTED' && mine.review_note === 'มาตรวจบัตรก่อนนะ');
	await db.exec(`select apply_rider('จันทร์-ศุกร์ เที่ยง', null)`);
	ok('a rejected student can apply again', (await rpc(`my_rider_application()`)).status === 'PENDING');
	ok('still not a rider while waiting', (await one(`select is_rider() r`)).r === false);
});
await as(tina, async () => {
	const again = (await rpc(`admin_rider_applications()`)).find((a) => a.email === 'hana@mail.kmutt.ac.th');
	await db.exec(`select admin_review_rider_application('${again.id}', true, 'ตรวจบัตรแล้ว')`);
	const hanaRoster = (await rpc(`admin_riders()`)).find((r) => r.email === 'hana@mail.kmutt.ac.th'); ok('approving puts the student on the roster', hanaRoster?.note === 'ตรวจบัตรแล้ว' && hanaRoster.added_by === 'ทีน่า', JSON.stringify(hanaRoster));
	ok('approval is in the activity log', (await rpc(`admin_activity()`)).some((l) => l.action === 'RIDER_APPROVED' && l.target === 'ฮานะ'));
});
await as(hana, async () => ok('an approved student is a rider', (await one(`select is_rider() r`)).r === true));

// Round-up tip
ok('round-up tip goes to the next 5 baht', (await rpc(`jsonb_build_array(round_up_tip(52), round_up_tip(58), round_up_tip(55))`)).join() === '3,2,0');
const tipped = (cart, pay, tip) =>
	one(`select place_order_at('kfc-10', '${JSON.stringify(cart)}'::jsonb, 'sit', 1, null, '${pay}', null, ${tip}) as id`);
let cashTipped, ppTipped;
await as(alice, async () => {
	// A cart whose total is not already a multiple of 5
	let cart, base;
	for (let q = 1; q <= 4; q++) {
		// 18-baht drinks: 18 + 15 = 33, so the round-up is 2
		cart = [{ menu_item_id: 'kfc-10-1', quantity: q }];
		const probe = await orderRow((await tipped(cart, 'CASH', 0)).id);
		await db.exec(`select cancel_order('${probe.id}')`);
		base = probe.total_price;
		if (base % 5) break;
	}
	const tip = (5 - (base % 5)) % 5;
	await expectError('only the round-up is accepted as a tip', `select place_order_at('kfc-10', '${JSON.stringify(cart)}'::jsonb, 'sit', 1, null, 'CASH', null, ${tip + 1})`, 'BAD_TIP');
	cashTipped = await orderRow((await tipped(cart, 'CASH', tip)).id);
	ok('the tip is added to the order total', tip > 0 && cashTipped.total_price === base + tip && cashTipped.tip === tip && cashTipped.tip_in_total === true, JSON.stringify({ base, tip, total: cashTipped.total_price }));
	ok('the rounded total ends in 0 or 5', cashTipped.total_price % 5 === 0);
	ppTipped = await orderRow((await tipped(cart, 'PROMPTPAY', tip)).id);
});
await db.exec(`update orders set rider_id = '${gina}', status = 'COMPLETED', completed_at = now() where id in ('${cashTipped.id}', '${ppTipped.id}')`);
const owedOf = async (id) => (await one(`select rider_owed(o) v from orders o where id = '${id}'`)).v;
ok('PromptPay: the rider is owed what they paid the stall + fee + tip', (await owedOf(ppTipped.id)) === ppTipped.food_total - ppTipped.store_discount + ppTipped.delivery_fee + ppTipped.tip);
ok('cash: the rider kept the tip at the door (only the app’s discounts are owed)', (await owedOf(cashTipped.id)) === cashTipped.code_discount + cashTipped.partner_discount - cashTipped.store_discount);
await as(alice, async () => {
	await db.exec(`select rate_order('${ppTipped.id}', 5, '{}', 50)`);
	ok('rating no longer changes the tip', (await orderRow(ppTipped.id)).tip === ppTipped.tip);
});
await db.exec(`update orders set tip = 20, tip_in_total = false where id = '${ppTipped.id}'`);
ok('a tip that was never paid in is left out of the payout', (await owedOf(ppTipped.id)) === ppTipped.food_total - ppTipped.store_discount + ppTipped.delivery_fee);
await db.exec(`update orders set payout_paid_at = now() where id in ('${cashTipped.id}', '${ppTipped.id}')`);

// ---------- Partner dashboard: own sales, open/close, sold out ----------
await as(alice, () => expectError('a buyer has no store dashboard', `select partner_dashboard()`, 'PARTNER_ONLY'));
await as(sam, () => expectError('team members are not partners either', `select partner_set_store_open(false)`, 'PARTNER_ONLY'));
const expectedToday = await one(`select coalesce(sum(food_total - store_discount), 0)::int as sales, count(*)::int as orders from orders
	where store_id = 'kfc-05' and status = 'COMPLETED' and bkk(completed_at)::date = bkk_today()`);
await as(panee, async () => {
	const d = await rpc(`partner_dashboard()`);
	ok('the dashboard is for the partner’s own store', d.store_id === 'kfc-05' && d.is_open === true);
	ok('today’s sales are what the store received (menu price less its own deals)', Number(d.today.sales) === expectedToday.sales && Number(d.today.orders) === expectedToday.orders, JSON.stringify({ got: d.today, want: expectedToday }));
	ok('7 days by default, 30 on request', d.days.length === 7 && (await rpc(`partner_dashboard(30)`)).days.length === 30 && d.days.at(-1).sales === d.today.sales);
	ok('best sellers come from finished orders', Array.isArray(d.top_items) && d.top_items.every((t) => t.qty > 0));
	const text = JSON.stringify(d);
	ok('the store never sees buyer names or phones', !text.includes('0811111111') && !text.includes('Alice') && !text.includes('"customer'));
});
// An order on its way shows up for the stall, with the rider's nickname
let onTheWay;
await as(alice, async () => (onTheWay = (await placeOrder('kfc-05', [{ menu_item_id: 'kfc-05-1', quantity: 1 }])).id));
await as(gina, () => db.exec(`select accept_order('${onTheWay}')`));
await as(panee, async () => {
	const live = (await rpc(`partner_dashboard()`)).live.find((o) => o.id === onTheWay);
	ok('orders on the way list dishes and who collects', !!live && live.status === 'ACCEPTED' && live.rider === 'จีน่า' && live.items?.[0]?.quantity === 1);
});
await as(gina, () => db.exec(`select release_order('${onTheWay}')`));
await as(alice, () => db.exec(`select cancel_order('${onTheWay}')`));
// Open / close and sold out
await as(panee, async () => {
	await db.exec(`select partner_set_store_open(false)`);
	ok('the partner can close their store', (await one(`select is_open from stores where id = 'kfc-05'`)).is_open === false);
	await expectError('another store’s dish cannot be touched', `select partner_set_item_available('kfc-10-1', false)`, 'ITEM_NOT_FOUND');
	await db.exec(`select partner_set_item_available('kfc-05-1', false)`);
	ok('the partner can mark a dish sold out', (await one(`select is_available from menu_items where id = 'kfc-05-1'`)).is_available === false);
});
await as(alice, () => expectError('a closed store takes no orders', `select place_order_at('kfc-05', '[{"menu_item_id":"kfc-05-4","quantity":1}]'::jsonb, 'sit', 1, null, 'CASH', null)`, 'STORE_UNAVAILABLE'));
await as(panee, async () => {
	await db.exec(`select partner_set_store_open(true); select partner_set_item_available('kfc-05-1', true)`);
	ok('and open it again', (await one(`select is_open from stores where id = 'kfc-05'`)).is_open === true);
});
await as(tina, async () => {
	const log = await rpc(`admin_activity()`);
	ok('the team sees what the store did', log.some((l) => l.action === 'STORE_CLOSED' && l.detail?.by === 'partner') && log.some((l) => l.action === 'ITEM_OFF' && l.detail?.by === 'partner'));
});

// ---------- Team members with a personal email ----------
await expectError('a stranger with a personal email still cannot sign up', `insert into auth.users (email) values ('stranger@gmail.com')`, 'KMUTT_ONLY');
await as(tina, () => db.exec(`select admin_set_member('Kai.Team@Gmail.com', 'STAFF', 'ใช้เมลส่วนตัว')`));
const kai = await newUser('kai.team@gmail.com', 'Kai Team');
ok('a team member can sign up with a personal email', (await one(`select role from profiles where id = '${kai}'`)).role === 'ADMIN');
await as(kai, async () => {
	ok('and opens the console with their role', (await rpc(`team_me()`))?.role === 'STAFF');
	ok('can work the console', (await rpc(`admin_overview()`)).stores_total === 12);
	await expectError('but cannot become a rider (not a student)', `select apply_rider('ทุกวัน', null)`, 'STUDENT_ONLY');
	await expectError('and the profile role alone approves nothing', `select admin_review_promo('${coPromo}', true, null)`, 'ADMIN_ONLY');
});
await as(tina, () => db.exec(`select admin_remove_member('kai.team@gmail.com')`));
await as(kai, async () => {
	ok('taken off the team, the console closes', (await rpc(`team_me()`)) === null);
	ok('and the leftover profile role is not team either', (await one(`select is_team() as t`)).t === false);
	await expectError('so home banners are closed to them', `insert into home_banners (id, image_url, title) values ('kai', 'https://x/y.png', 'x')`, 'row-level security');
});

// ---------- Partners run their own menu and store details ----------
const PHOTO = 'https://proj.supabase.co/storage/v1/object/public/store-banners/kfc-05/menu-1.jpg';
const save = (id, name, cat, price, special, desc, img) =>
	`select partner_save_menu_item(${id ? `'${id}'` : 'null'}, '${name}', '${cat}', ${price}, ${special ?? 'null'}, '${desc}', '${img}') as id`;
await as(alice, () => expectError('a buyer cannot touch a menu', save(null, 'x', 'y', 30, null, '', ''), 'PARTNER_ONLY'));
let newDish;
await as(panee, async () => {
	await expectError('a photo from elsewhere is refused', save(null, 'ข้าวไก่ทอดกระเทียม', 'ข้าว', 45, 55, '', 'https://evil.example/x.jpg'), 'BAD_IMAGE');
	await expectError('another store’s folder is refused too', save(null, 'ข้าวไก่ทอดกระเทียม', 'ข้าว', 45, 55, '', PHOTO.replace('kfc-05', 'kfc-10')), 'BAD_IMAGE');
	await expectError('price must be 1-2000', save(null, 'ข้าว', 'ข้าว', 0, null, '', ''), 'BAD_PRICE');
	await expectError('พิเศษ must cost more', save(null, 'ข้าว', 'ข้าว', 40, 40, '', ''), 'BAD_SPECIAL_PRICE');
	await expectError('a dish needs a name', save(null, '  ', 'ข้าว', 40, null, '', ''), 'BAD_ITEM_NAME');
	await expectError('and a category', save(null, 'ข้าว', '', 40, null, '', ''), 'BAD_CATEGORY');
	newDish = (await one(save(null, 'ข้าวไก่ทอดกระเทียม', 'ข้าวและไก่', 45, 55, 'กรอบนอกนุ่มใน', PHOTO))).id;
	ok('the partner adds a dish with their own photo', /^kfc-05-/.test(newDish));
	await expectError('another store’s dish cannot be edited', save('kfc-10-1', 'x', 'y', 30, null, '', ''), 'ITEM_NOT_FOUND');
	// Changing a mock-up dish keeps its mock-up photo: only a new photo must be the store's own
	const mock = await one(`select image_url from menu_items where id = 'kfc-05-2'`);
	await db.exec(save('kfc-05-2', 'ข้าวคั่วกลิ้งไก่', 'ข้าวและไก่', 35, 45, '', mock.image_url));
	ok('the partner changes a price, the old photo stays', (await one(`select price, image_url from menu_items where id = 'kfc-05-2'`)).price === 35);
});
await db.exec(`set role anon;`);
const shown = await one(`select name, price, special_price, image_url, category from menu_items where id = '${newDish}'`);
ok('buyers see the new dish at once', shown?.price === 45 && shown.special_price === 55 && shown.image_url === PHOTO && shown.category === 'ข้าวและไก่');
await db.exec(`reset role;`);
await as(alice, async () => {
	const o = await orderRow((await placeOrder('kfc-05', [{ menu_item_id: newDish, quantity: 1, special: true }])).id);
	ok('the new dish can be ordered at the partner’s price', o.food_total === 55, JSON.stringify(o));
	await db.exec(`select cancel_order('${o.id}')`);
});
// Removing a dish that is in old orders: archived, history kept
const historyBefore = Number((await one(`select count(*) n from order_items where menu_item_id = 'kfc-05-4'`)).n);
await as(panee, () => db.exec(`select partner_remove_menu_item('kfc-05-4')`));
await db.exec(`set role anon;`);
ok('a removed dish disappears from the menu', (await one(`select count(*) n from menu_items where id = 'kfc-05-4'`)).n == 0);
await db.exec(`reset role;`);
ok('old orders still show the removed dish', historyBefore > 0 && Number((await one(`select count(*) n from order_items where menu_item_id = 'kfc-05-4'`)).n) === historyBefore);
await as(alice, () => expectError('a removed dish cannot be ordered', `select place_order_at('kfc-05', '[{"menu_item_id":"kfc-05-4","quantity":1}]'::jsonb, 'sit', 1, null, 'CASH', null)`, 'ITEM_UNAVAILABLE'));
await as(tina, async () => {
	await db.exec(`select admin_set_item_available('kfc-05-4', true)`);
	ok('the console menu hides removed dishes', !(await rpc(`admin_store_menu('kfc-05')`)).some((m) => m.id === 'kfc-05-4'));
});
ok('not even the console can put a removed dish back on sale', (await one(`select is_available from menu_items where id = 'kfc-05-4'`)).is_available === false);
await as(panee, () => expectError('a removed dish cannot be removed again', `select partner_remove_menu_item('kfc-05-4')`, 'ITEM_NOT_FOUND'));
// Store details
await as(panee, async () => {
	await expectError('queue time is 0-120 minutes', `select partner_update_store_info('ร้านป้าณี', 'ข้าวมันไก่', '', 200)`, 'BAD_QUEUE');
	await expectError('a store needs a name', `select partner_update_store_info(' ', 'ข้าวมันไก่', '', 5)`, 'BAD_STORE_NAME');
	await db.exec(`select partner_update_store_info('ร้านป้าณี ข้าวมันไก่', 'ข้าวมันไก่ ฮาลาล', 'สูตรเด็ดตั้งแต่ปี 2540', 7)`);
	const st = await one(`select name, category, description, queue_minutes from stores where id = 'kfc-05'`);
	ok('the partner edits the store name, category, description and queue', st.name === 'ร้านป้าณี ข้าวมันไก่' && st.queue_minutes === 7 && st.description === 'สูตรเด็ดตั้งแต่ปี 2540');
});
await as(tina, async () => {
	const acts = new Set((await rpc(`admin_activity()`)).filter((l) => l.detail?.by === 'partner').map((l) => l.action));
	ok('the team sees every menu and store change', ['ITEM_ADDED', 'ITEM_EDITED', 'ITEM_REMOVED', 'STORE_EDITED'].every((a) => acts.has(a)), [...acts].join(','));
});

// ---------- Free delivery is the team's call ----------
await as(panee, async () => {
	await expectError('a store cannot give free delivery on its own', `insert into promotions (store_id, kind, title, free_delivery) values ('kfc-05', 'DEAL', 'ฟรีค่าหิ้วเอง', true)`, 'FREE_DELIVERY_NEEDS_TEAM');
	const deal = await one(`insert into promotions (store_id, kind, title, discount) values ('kfc-05', 'DEAL', 'ลด 5 บาท', 5) returning id, approved`);
	ok('a plain store discount still goes live at once', deal.approved === true);
	await expectError('nor turn free delivery on later', `update promotions set free_delivery = true where id = '${deal.id}'`, 'FREE_DELIVERY_NEEDS_TEAM');
	await expectError('and there is no joint promotion to ask through', `insert into promotions (store_id, kind, title, free_delivery) values ('kfc-05', 'CO_PROMO', 'ขอฟรีค่าหิ้ว', true)`, 'STORE_DEALS_ONLY');
	await db.exec(`delete from promotions where id = '${deal.id}'`);
});

// ---------- Who pays a discount ----------
await db.exec(`update promotions set active = true where title = 'ลด 7 บาท'`);
let dealOrder, codeOrder;
await as(alice, async () => {
	dealOrder = await orderRow((await placeOrder('kfc-05', [{ menu_item_id: 'kfc-05-1', quantity: 1 }])).id);
	codeOrder = await orderRow((await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-8', quantity: 1 }], 'GOOSEFREE')).id);
});
ok('a store deal is recorded as the store’s discount', dealOrder.partner_discount > 0 && dealOrder.store_discount === dealOrder.partner_discount, JSON.stringify({ pd: dealOrder.partner_discount, sd: dealOrder.store_discount }));
ok('an app code is the app’s money', codeOrder.code_discount > 0 && codeOrder.store_discount === 0);
await db.exec(`update orders set rider_id = '${gina}', status = 'COMPLETED', completed_at = now() where id in ('${dealOrder.id}', '${codeOrder.id}')`);
ok('cash + store deal: the rider paid the stall less, nothing to make up', (await owedOf(dealOrder.id)) === 0);
ok('cash + app code: the team makes up the code to the rider', (await owedOf(codeOrder.id)) === codeOrder.code_discount);
await db.exec(`update orders set payout_paid_at = now() where id in ('${dealOrder.id}', '${codeOrder.id}')`);
await as(gina, async () => {
	const job = (await rpc(`rider_board()`)) ?? {};
	ok('the rider board carries the store discount', !JSON.stringify(job).includes('"store_discount": null'));
});

// ---------- The team sets stores up itself ----------
let newStore;
await as(alice, () => expectError('a buyer cannot create a store', `select admin_create_store('ร้านใหม่', 'ข้าว', 'kfc-main', '13', '', 5)`, 'TEAM_ONLY'));
await as(sam, async () => {
	await expectError('the zone must be a real canteen', `select admin_create_store('ร้านใหม่', 'ข้าว', 'moon', '13', '', 5)`, 'BAD_ZONE');
	newStore = (await one(`select admin_create_store('ร้านข้าวแกงป้าแดง', 'ข้าวราดแกง', 'kfc-main', '13', 'ค่ากล่อง 5 บาท', 8) as id`)).id;
	ok('staff create a store with the next free KFC id', /^kfc-\d{2}$/.test(newStore) && Number((await one(`select count(*) n from stores where id = '${newStore}'`)).n) === 1, newStore);
	const listed = (await rpc(`admin_stores()`)).find((s) => s.id === newStore);
	ok('a new store starts hidden and closed, with no owner yet', listed?.hidden === true && listed.is_open === false && listed.owner_email === null && listed.name === 'ร้านข้าวแกงป้าแดง');
});
await db.exec(`set role anon;`);
ok('buyers do not see a hidden store', (await one(`select count(*) n from stores where id = '${newStore}'`)).n == 0);
await db.exec(`reset role;`);
const TEAM_PHOTO = `https://proj.supabase.co/storage/v1/object/public/store-banners/${newStore}/menu-1.jpg`;
let teamDish;
await as(sam, async () => {
	ok('the team sees hidden stores', Number((await one(`select count(*) n from stores where id = '${newStore}'`)).n) === 1);
	teamDish = (await one(`select admin_save_menu_item('${newStore}', null, 'ข้าวแกงเขียวหวาน', 'ข้าวราดแกง', 35, 45, '', '${TEAM_PHOTO}') as id`)).id;
	ok('the team adds a dish with a photo to any store', teamDish.startsWith(`${newStore}-`));
	await expectError('a photo from another store’s folder is refused', `select admin_save_menu_item('${newStore}', null, 'x', 'y', 30, null, '', '${TEAM_PHOTO.replace(newStore, 'kfc-05')}')`, 'BAD_IMAGE');
	await db.exec(`select admin_save_menu_item('kfc-05', 'kfc-05-2', 'ข้าวคั่วกลิ้งไก่', 'ข้าวและไก่', 38, 45, '', (select image_url from menu_items where id = 'kfc-05-2'))`);
	ok('the team edits a partner’s dish too', (await one(`select price from menu_items where id = 'kfc-05-2'`)).price === 38);
	await db.exec(`select admin_update_store_info('${newStore}', 'ร้านข้าวแกงป้าแดง', 'ข้าวราดแกง', 'เปิด 7:00-14:00', 6)`);
	await db.exec(`select admin_update_storefront('${newStore}', 'แกงสดทุกเช้า', null, 5, '${TEAM_PHOTO.replace('menu-1', 'logo')}', '${TEAM_PHOTO.replace('menu-1', 'photo')}')`);
	const st = await one(`select description, queue_minutes, tagline, fast_lane_minutes, logo_url, image_url from stores where id = '${newStore}'`);
	ok('the team edits store details and storefront', st.description === 'เปิด 7:00-14:00' && st.queue_minutes === 6 && st.tagline === 'แกงสดทุกเช้า' && st.fast_lane_minutes === 5 && st.image_url.endsWith('/photo.jpg'));
	await expectError('only ADMIN clears a whole menu', `select admin_clear_menu('${newStore}')`, 'ADMIN_ONLY');
	await db.exec(`select admin_set_store_hidden('${newStore}', false); select admin_set_store_open('${newStore}', true)`);
});
await db.exec(`set role anon;`);
ok('once shown, buyers see the store and its dish', (await one(`select count(*) n from stores where id = '${newStore}' and is_open`)).n == 1 && (await one(`select count(*) n from menu_items where id = '${teamDish}'`)).n == 1);
await db.exec(`reset role;`);
await as(alice, async () => {
	const o = await orderRow((await placeOrder(newStore, [{ menu_item_id: teamDish, quantity: 1 }])).id);
	ok('a team-built store takes orders', o.food_total === 35 && o.pickup_name === 'ร้านข้าวแกงป้าแดง');
	await db.exec(`select cancel_order('${o.id}')`);
});
await as(tina, async () => {
	ok('ADMIN clears the whole menu in one go', (await rpc(`admin_clear_menu('${newStore}')`)) === 1);
	await db.exec(`select admin_set_store_hidden('${newStore}', true)`);
	ok('hiding a store also stops orders', (await one(`select is_open from stores where id = '${newStore}'`)).is_open === false);
	const acts = new Set((await rpc(`admin_activity()`)).map((l) => l.action));
	ok('the log shows the team built the store', ['STORE_CREATED', 'STORE_SHOWN', 'STORE_HIDDEN', 'MENU_CLEARED'].every((a) => acts.has(a)) && (await rpc(`admin_activity()`)).some((l) => l.action === 'ITEM_ADDED' && l.detail?.by === 'team'));
	await db.exec(`select admin_invite_partner('owner.red@example.com', '${newStore}')`);
});
const red = await newUser('owner.red@example.com', 'ป้าแดง');
await as(red, async () => {
	ok('the invited owner takes over the team-built store', (await one(`select partner_store_id from profiles where id = '${red}'`)).partner_store_id === newStore);
	await db.exec(`select partner_update_store_info('ร้านป้าแดง', 'ข้าวราดแกง', 'เปิด 7:00-14:00', 6)`);
});
await as(sam, async () => {
	await db.exec(`select admin_update_store_info('${newStore}', 'ร้านป้าแดง (KFC ล็อก 13)', 'ข้าวราดแกง', 'เปิด 7:00-14:00', 6)`);
	ok('and the team can still edit it', (await one(`select name from stores where id = '${newStore}'`)).name === 'ร้านป้าแดง (KFC ล็อก 13)');
});

// ---------- Recycle bin: ADMIN deletes a store, restores it, or it is erased after 60 days ----------
let binDish, liveOrder;
await as(sam, async () => {
	await db.exec(`select admin_set_store_hidden('${newStore}', false); select admin_set_store_open('${newStore}', true)`);
	binDish = (await one(`select admin_save_menu_item('${newStore}', null, 'ข้าวผัดกะเพรา', 'ข้าว', 40, null, '', '') as id`)).id;
	await expectError('only ADMIN deletes a store', `select admin_delete_store('${newStore}')`, 'ADMIN_ONLY');
	await expectError('only ADMIN opens the recycle bin', `select admin_trash()`, 'ADMIN_ONLY');
});
await as(alice, async () => {
	liveOrder = (await placeOrder(newStore, [{ menu_item_id: binDish, quantity: 1 }])).id;
});
await as(tina, () => expectError('a store with an order in progress cannot be deleted', `select admin_delete_store('${newStore}')`, 'STORE_HAS_ACTIVE_ORDERS'));
await db.exec(`update orders set status = 'COMPLETED', completed_at = now() where id = '${liveOrder}'`);
await as(tina, async () => {
	await db.exec(`select admin_delete_store('${newStore}')`);
	ok('a deleted store leaves the team’s store list', !(await rpc(`admin_stores()`)).some((s) => s.id === newStore));
	const bin = (await rpc(`admin_trash()`)).find((s) => s.id === newStore);
	const days = bin ? (Date.parse(bin.purge_at) - Date.parse(bin.deleted_at)) / 86_400_000 : 0;
	ok('it waits in the bin for 60 days, with who deleted it', days === 60 && !!bin.deleted_by && bin.orders_total >= 1, JSON.stringify(bin));
	await expectError('a store in the bin cannot be deleted twice', `select admin_delete_store('${newStore}')`, 'STORE_NOT_FOUND');
	await expectError('the nightly clean-up is not callable from the app', `select purge_expired_stores()`, 'permission denied');
});
const deleted = await one(`select hidden, is_open from stores where id = '${newStore}'`);
ok('deleting hides and closes the store', deleted.hidden === true && deleted.is_open === false);
await db.exec(`set role anon;`);
ok('buyers no longer see a deleted store', (await one(`select count(*) n from stores where id = '${newStore}'`)).n == 0);
await db.exec(`reset role;`);
await as(sam, async () => {
	ok('nor does the team in the app', Number((await one(`select count(*) n from stores where id = '${newStore}'`)).n) === 0);
	await expectError('a deleted store cannot be edited', `select admin_update_store_info('${newStore}', 'x', 'y', '', 5)`, 'STORE_DELETED');
	await expectError('nor reopened', `select admin_set_store_open('${newStore}', true)`, 'STORE_DELETED');
	await expectError('nor given dishes', `select admin_save_menu_item('${newStore}', null, 'x', 'y', 30, null, '', '')`, 'STORE_DELETED');
});
await as(red, () => expectError('its owner no longer runs it', `select partner_update_store_info('x', 'y', '', 5)`, 'PARTNER_ONLY'));
await as(alice, () =>
	expectError('and it takes no orders', `select place_order_at('${newStore}', '[{"menu_item_id":"${binDish}","quantity":1}]'::jsonb, 'sit', 1, '', 'CASH', null)`, 'STORE_UNAVAILABLE')
);
await as(tina, async () => {
	await db.exec(`select admin_restore_store('${newStore}')`);
	const back = (await rpc(`admin_stores()`)).find((s) => s.id === newStore);
	ok('ADMIN restores it, hidden and closed until shown', back?.hidden === true && back.is_open === false && back.items_total === 1 && back.owner_email === 'owner.red@example.com', JSON.stringify(back));
	ok('the bin is empty again', !(await rpc(`admin_trash()`)).some((s) => s.id === newStore));
});
await as(red, async () => {
	await db.exec(`select partner_update_store_info('ร้านป้าแดง', 'ข้าวราดแกง', 'เปิด 7:00-14:00', 6)`);
	ok('the owner runs it again after a restore', (await one(`select name from stores where id = '${newStore}'`)).name === 'ร้านป้าแดง');
});
// 61 days in the bin: the next look at the bin erases it
await as(tina, () => db.exec(`select admin_delete_store('${newStore}')`));
await expectError('the bin date cannot be changed either', `update stores set deleted_at = now() - interval '61 days' where id = '${newStore}'`, 'STORE_DELETED');
await db.exec(`alter table stores disable trigger stores_keep_deleted_shut; update stores set deleted_at = now() - interval '61 days' where id = '${newStore}'; alter table stores enable trigger stores_keep_deleted_shut;`);
await as(tina, async () => {
	await expectError('past 60 days a store cannot be restored', `select admin_restore_store('${newStore}')`, 'STORE_NOT_FOUND');
	ok('and it is no longer in the bin', !(await rpc(`admin_trash()`)).some((s) => s.id === newStore));
});
ok('after 60 days the store is erased with its menu', Number((await one(`select count(*) n from stores where id = '${newStore}'`)).n) === 0 && Number((await one(`select count(*) n from menu_items where store_id = '${newStore}'`)).n) === 0);
const kept = await one(`select store_id, pickup_name, (select count(*) from order_items where order_id = o.id) as lines from orders o where id = '${liveOrder}'`);
ok('its past orders stay, with the store name and the dishes', kept.store_id === null && kept.pickup_name.startsWith('ร้านป้าแดง') && Number(kept.lines) === 1, JSON.stringify(kept));
ok('the erase is in the log', (await one(`select detail from admin_log where action = 'STORE_PURGED' and target_id = '${newStore}'`)).detail.why === 'expired');
ok('the owner is left without a store', (await one(`select partner_store_id from profiles where id = '${red}'`)).partner_store_id === null);
await as(tina, async () => {
	const next = (await one(`select admin_create_store('ร้านทดลองลบ', 'ทดลอง', 'kfc-main', '', '', 5) as id`)).id;
	ok('a new store never reuses an erased store’s id', Number(next.split('-')[1]) > Number(newStore.split('-')[1]), `${next} vs ${newStore}`);
	await expectError('only a store in the bin can be erased', `select admin_purge_store('${next}')`, 'STORE_NOT_FOUND');
	await db.exec(`select admin_delete_store('${next}'); select admin_purge_store('${next}')`);
	ok('ADMIN can erase a store in the bin straight away', Number((await one(`select count(*) n from stores where id = '${next}'`)).n) === 0);
	const acts = new Set((await rpc(`admin_activity()`)).map((l) => l.action));
	ok('the log shows delete, restore and erase', ['STORE_DELETED', 'STORE_RESTORED', 'STORE_PURGED'].every((a) => acts.has(a)));
});

// ---------- Real stores: โรงอาหารหอหญิง, imported from the stalls' PDF ----------
await db.exec(readFileSync(`${ROOT}/data/female_dorm_stores.sql`, 'utf8'));
await db.exec(readFileSync(`${ROOT}/data/female_dorm_stores.sql`, 'utf8'));
const fd = await one(`select count(*) filter (where zone = 'female-dorm' and hidden and not is_open) n, (select count(*) from menu_items where store_id like 'female-dorm-%') items from stores where id like 'female-dorm-%'`);
ok('the female dorm stalls load hidden and closed, and loading twice changes nothing', Number(fd.n) === 6 && Number(fd.items) === 86, JSON.stringify(fd));
await as(tina, async () => {
	await db.exec(`select admin_set_store_hidden('female-dorm-06', false); select admin_set_store_open('female-dorm-06', true)`);
	const next = (await one(`select admin_create_store('ร้านใหม่หอหญิง', 'ทดลอง', 'female-dorm', '', '', 5) as id`)).id;
	ok('a new store in the canteen continues its numbering', next === 'female-dorm-07', next);
	await db.exec(`select admin_delete_store('${next}'); select admin_purge_store('${next}')`);
});
await as(alice, async () => {
	const o = await orderRow((await placeOrder('female-dorm-06', [{ menu_item_id: 'female-dorm-06-1', quantity: 1 }, { menu_item_id: 'female-dorm-06-2', quantity: 1, special: true }])).id);
	ok('a shown stall takes orders, with the 22 oz. price as พิเศษ', o.food_total === 35, String(o.food_total));
	await db.exec(`select cancel_order('${o.id}')`);
});
await as(tina, () => db.exec(`select admin_set_store_hidden('female-dorm-06', true)`));
await db.exec(readFileSync(`${ROOT}/data/male_dorm_stores.sql`, 'utf8'));
await db.exec(readFileSync(`${ROOT}/data/male_dorm_stores.sql`, 'utf8'));
const md = await one(`select count(*) filter (where zone = 'male-dorm' and hidden and not is_open) n, (select count(*) from menu_items where store_id like 'male-dorm-%') items from stores where id like 'male-dorm-%'`);
ok('the male dorm stalls load hidden and closed, and loading twice changes nothing', Number(md.n) === 3 && Number(md.items) === 111, JSON.stringify(md));

// ---------- CB1: source prices, repeatable import and real ordering ----------
const loongnoomSQL = readFileSync(`${ROOT}/data/loongnoom_square.sql`, 'utf8');
const loongnoomData = JSON.parse(readFileSync(`${ROOT}/data/loongnoom_square.json`, 'utf8'));
await db.exec(loongnoomSQL);
await db.exec(loongnoomSQL);
const ln = await one(`select zone, hidden, is_open, logo_url, (select count(*) from menu_items where store_id = s.id) items from stores s where id = 'loongnoom-square'`);
ok('CB1 import creates one hidden, closed store with 87 menus', ln.zone === 'cb1' && ln.hidden && !ln.is_open && Number(ln.items) === 87);
const lnItems = (await db.query(`select id, name, price, category, sort from menu_items where store_id = 'loongnoom-square' order by sort`)).rows;
const sourceItems = loongnoomData.sections.flatMap((section) => section.items.map((i) => ({ ...i, category: section.category })));
ok('every imported name, price, category and order matches the reviewed source', sourceItems.every((i, n) => {
	const actual = lnItems[n];
	return actual.id === `loongnoom-square-${i.code}` && actual.name === i.name && actual.price === i.price && actual.category === i.category && actual.sort === n + 1;
}));
ok('repeat import adds only one audit entry', Number((await one(`select count(*) n from admin_log where action = 'STORE_IMPORTED' and target_id = 'loongnoom-square'`)).n) === 1);
await as(tina, () => db.exec(`select admin_set_store_hidden('loongnoom-square', false); select admin_set_store_open('loongnoom-square', true)`));
await as(alice, async () => {
	const o = await orderRow((await placeOrder('loongnoom-square', [{ menu_item_id: 'loongnoom-square-latte-iced', quantity: 1 }, { menu_item_id: 'loongnoom-square-latte-blended', quantity: 1 }])).id);
	ok('CB1 store can take orders with separate iced and blended prices', o.food_total === 55, String(o.food_total));
	await db.exec(`select cancel_order('${o.id}')`);
});
await db.exec(`update menu_items set price = 26, is_available = false where id = 'loongnoom-square-latte-iced'`);
await db.exec(loongnoomSQL);
const preserved = await one(`select price, is_available, (select hidden from stores where id = 'loongnoom-square') hidden from menu_items where id = 'loongnoom-square-latte-iced'`);
ok('reimport preserves team price, availability and store visibility edits', preserved.price === 26 && !preserved.is_available && !preserved.hidden);
await as(tina, () => db.exec(`select admin_set_store_hidden('loongnoom-square', true); select admin_set_store_open('loongnoom-square', false)`));

// ---------- QR payment test mode: pay without a transfer while the team has it on ----------
let testOrder, cashTest;
await as(alice, async () => {
	ok('test mode starts off', (await rpc(`app_flags()`)).payment_test_mode === false);
	testOrder = (await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }], null, 'PROMPTPAY')).id;
	cashTest = (await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }])).id;
	await expectError('no test payment while test mode is off', `select pay_order_test('${testOrder}')`, 'TEST_MODE_OFF');
});
await db.exec(`set role anon;`);
ok('anyone can read whether test mode is on', (await one(`select app_flags() as f`)).f.payment_test_mode === false);
await expectError('but not flip it', `select admin_set_payment_test_mode(true)`, 'permission denied');
await db.exec(`reset role;`);
await as(sam, () => expectError('only ADMIN turns test mode on', `select admin_set_payment_test_mode(true)`, 'ADMIN_ONLY'));
// The real project has no is_test_project row: even an ADMIN cannot switch test mode on there
await as(tina, () => expectError('on the real project even ADMIN cannot turn test mode on', `select admin_set_payment_test_mode(true)`, 'TEST_PROJECT_ONLY'));
await db.exec(`insert into app_settings (key, value) values ('is_test_project', 'true') on conflict (key) do update set value = 'true'::jsonb`);
await as(tina, async () => {
	await db.exec(`select admin_set_payment_test_mode(true)`);
	const f = await rpc(`app_flags()`);
	ok('ADMIN turns test mode on, with who and when', f.payment_test_mode === true && !!f.payment_test_since && !!f.payment_test_by, JSON.stringify(f));
});
await as(bob, () => expectError('nobody pays another buyer’s order', `select pay_order_test('${testOrder}')`, 'ORDER_NOT_FOUND'));
await as(alice, async () => {
	await expectError('a cash order has nothing to pay by QR', `select pay_order_test('${cashTest}')`, 'ORDER_NOT_PAYABLE');
	await db.exec(`select pay_order_test('${testOrder}')`);
	await expectError('a test payment cannot be made twice', `select pay_order_test('${testOrder}')`, 'ALREADY_PAID');
});
const paidTest = await one(`select paid_at, slip_ref, order_code from orders where id = '${testOrder}'`);
ok('the order is paid and marked as a test', !!paidTest.paid_at && paidTest.slip_ref === `TEST:${paidTest.order_code}`);
ok('the chat says no money moved', Number((await one(`select count(*) n from chat_messages where order_id = '${testOrder}' and body like 'โหมดทดสอบ%'`)).n) === 1);
await as(tina, async () => {
	await db.exec(`select admin_set_payment_test_mode(false)`);
	const acts = new Set((await rpc(`admin_activity()`)).map((l) => l.action));
	ok('switching test mode is in the log', acts.has('PAYMENT_TEST_ON') && acts.has('PAYMENT_TEST_OFF'));
});
await as(alice, async () => {
	const again = (await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }], null, 'PROMPTPAY')).id;
	await expectError('once off, test payments stop at once', `select pay_order_test('${again}')`, 'TEST_MODE_OFF');
	await db.exec(`select cancel_order('${again}'); select cancel_order('${cashTest}')`);
});

// ---------- Delivery fee: distance, floor, rain; at most 5 items ----------
const quote = async (store, drop, floor) => (await one(`select delivery_quote(${store ? `'${store}'` : 'null'}, '${drop}', ${floor}) as q`)).q;
await db.exec(`set role anon;`);
const qNear = await quote('kfc-10', 'sit', 1);
ok('near the canteen (KFC → SIT) the fee is 15', qNear.base === 15 && qNear.fee === 15 && qNear.near === true, JSON.stringify(qNear));
const qFar = await quote('kfc-10', 'dorm-s6', 1);
ok('far from it (KFC → หอ S6) the fee is 20', qFar.base === 20 && qFar.fee === 20 && qFar.near === false, JSON.stringify(qFar));
ok('1 baht a floor above the first', (await quote('kfc-10', 'sit', 5)).fee === 19);
ok('never above 25 in normal times (near, floor 20)', (await quote('kfc-10', 'sit', 20)).fee === 25);
ok('never above 25 in normal times (far, floor 8)', (await quote('kfc-10', 'dorm-s6', 8)).fee === 25);
ok('ฝากซื้อ starts at 20, plus floors', (await quote(null, 'sit', 3)).fee === 22);
await expectError('an unknown drop-off is refused', `select delivery_quote('kfc-10', 'moon', 1)`, 'BAD_DROPOFF');
await expectError('floor 0 is refused', `select delivery_quote('kfc-10', 'sit', 0)`, 'BAD_FLOOR');
await expectError('floor 21 is refused', `select delivery_quote('kfc-10', 'sit', 21)`, 'BAD_FLOOR');
await db.exec(`reset role;`);

await as(alice, async () => {
	await expectError('the app cannot use the old flat-fee order call', `select place_order('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1}]'::jsonb, 'x', '', 'CASH', null)`, 'permission denied');
	await expectError('6 items is more than a rider can carry', `select place_order_at('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":4},{"menu_item_id":"kfc-10-8","quantity":2}]'::jsonb, 'sit', 1, '', 'CASH', null)`, 'TOO_MANY_ITEMS');
	const five = await orderRow((await one(`select place_order_at('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":5}]'::jsonb, 'sit', 5, '', 'CASH', null) as id`)).id);
	ok('5 items from one store go, with the floor fee', five.delivery_fee === 19 && five.dropoff_floor === 5 && five.dropoff_id === 'sit' && five.dropoff_name === 'อาคาร SIT ชั้น 5', JSON.stringify({ fee: five.delivery_fee, name: five.dropoff_name }));
	await db.exec(`select cancel_order('${five.id}')`);
});
await as(alice, () => expectError('a buyer cannot switch the rain fee on', `select admin_set_rain_surcharge(true)`, 'TEAM_ONLY'));
await as(sam, async () => {
	await db.exec(`select admin_set_rain_surcharge(true)`);
	ok('STAFF switches the rain fee on', (await rpc(`app_flags()`)).rain_surcharge === true);
});
ok('rain adds 5, even above 25', (await quote('kfc-10', 'sit', 1)).fee === 20 && (await quote('kfc-10', 'dorm-s6', 8)).fee === 30);
await as(alice, async () => {
	const wet = await orderRow((await one(`select place_order_at('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1}]'::jsonb, 'sit', 1, '', 'CASH', null) as id`)).id);
	ok('an order placed in the rain carries the rain fee', wet.delivery_fee === 20 && wet.fee_rain === 5);
	const errand = await orderRow((await one(`select place_custom_order_at('เซเว่นหน้าหอใน', 'นมจืด 2 กล่อง', 30, 'dorm-s6', 2, '') as id`)).id);
	ok('ฝากซื้อ in the rain: 20 + 1 floor + 5', errand.delivery_fee === 26 && errand.dropoff_name === 'หอพักหญิง S6 ชั้น 2');
	await db.exec(`select cancel_order('${wet.id}'); select cancel_order('${errand.id}')`);
});
await as(sam, () => db.exec(`select admin_set_rain_surcharge(false)`));
await as(tina, async () => {
	const acts = new Set((await rpc(`admin_activity()`)).map((l) => l.action));
	ok('the rain switch is in the log', acts.has('RAIN_ON') && acts.has('RAIN_OFF'));
});
ok('rain off: back to the normal fee', (await quote('kfc-10', 'sit', 1)).fee === 15);

// ---------- App discount codes: ADMIN creates, buyers redeem, uses run out ----------
await as(alice, () => expectError('a buyer cannot create a discount code', `select admin_create_promo_code('WELCOME10', 'AMOUNT', 10, now(), 5)`, 'TEAM_ONLY'));
await as(sam, () => expectError('STAFF cannot create one either (money given away)', `select admin_create_promo_code('WELCOME10', 'AMOUNT', 10, now(), 5)`, 'ADMIN_ONLY'));
await as(tina, async () => {
	await expectError('a code shorter than 3 characters is refused', `select admin_create_promo_code('ab', 'AMOUNT', 10, now(), 5)`, 'BAD_CODE');
	await expectError('an unknown kind is refused', `select admin_create_promo_code('BADKIND', 'PERCENT', 10, now(), 5)`, 'BAD_KIND');
	await expectError('AMOUNT needs an amount', `select admin_create_promo_code('NOAMOUNT', 'AMOUNT', null, now(), 5)`, 'BAD_AMOUNT');
	await expectError('FREE_DELIVERY takes no amount', `select admin_create_promo_code('EXTRA', 'FREE_DELIVERY', 10, now(), 5)`, 'BAD_AMOUNT');
	await expectError('max_uses must be at least 1', `select admin_create_promo_code('NOUSES', 'AMOUNT', 10, now(), 0)`, 'BAD_MAX_USES');
	const code = (await one(`select admin_create_promo_code('welcome10', 'AMOUNT', 10, now(), 2) as c`)).c;
	ok('the code is stored uppercase however it was typed', code === 'WELCOME10');
	await expectError('the same code cannot be made twice', `select admin_create_promo_code('WELCOME10', 'AMOUNT', 10, now(), 2)`, 'CODE_TAKEN');
	const row = (await rpc(`admin_promo_codes()`)).find((c) => c.code === 'WELCOME10');
	ok('the new code lists with 0 uses so far', row?.kind === 'AMOUNT' && row.amount === 10 && row.max_uses === 2 && row.active === true && row.uses === 0, JSON.stringify(row));
	// Scheduled for later ("จะปล่อยโค้ดตอนไหน"): not usable until then
	await db.exec(`select admin_create_promo_code('LATER5', 'AMOUNT', 5, now() + interval '1 day', 10)`);
});
await as(alice, async () => {
	await expectError('a code not started yet is refused when checked', `select check_promo_code('LATER5')`, 'PROMO_NOT_STARTED');
	await expectError('and refused at order time too', `select place_order_at('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1}]'::jsonb, 'sit', 1, '', 'CASH', 'LATER5')`, 'PROMO_NOT_STARTED');
	const check = (await one(`select check_promo_code('welcome10') as c`)).c;
	ok('checking a code (typed lowercase) previews its effect without using it up', check.code === 'WELCOME10' && check.kind === 'AMOUNT' && check.amount === 10);
	const o1 = await orderRow((await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }], 'WELCOME10')).id);
	ok('the code takes 10 ฿ off', o1.code_discount === 10);
	const o2 = await orderRow((await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }], 'WELCOME10')).id);
	ok('a second redemption still fits max_uses 2', o2.code_discount === 10);
	await expectError('a 3rd redemption is refused: max_uses reached', `select place_order_at('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1}]'::jsonb, 'sit', 1, '', 'CASH', 'WELCOME10')`, 'PROMO_USES_UP');
	await expectError('checking it now says the same', `select check_promo_code('WELCOME10')`, 'PROMO_USES_UP');
	// Cancelling an order that used the code frees a use back up
	await db.exec(`select cancel_order('${o1.id}')`);
	const o3 = await orderRow((await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }], 'WELCOME10')).id);
	ok('a cancelled redemption does not count against the limit', o3.code_discount === 10);
	await db.exec(`select cancel_order('${o2.id}'); select cancel_order('${o3.id}')`);
});
await as(tina, () => db.exec(`select admin_set_promo_code_active('WELCOME10', false)`));
await as(alice, () => expectError('a switched-off code is refused', `select check_promo_code('WELCOME10')`, 'PROMO_INVALID'));
await as(sam, () => expectError('STAFF cannot switch a code off either', `select admin_set_promo_code_active('LATER5', false)`, 'ADMIN_ONLY'));
await as(tina, async () => {
	const acts = new Set((await rpc(`admin_activity()`)).map((l) => l.action));
	ok('creating and switching a code is in the log', acts.has('PROMO_CODE_CREATED') && acts.has('PROMO_CODE_OFF'));
});
await db.exec(`set role anon;`);
await expectError('a signed-out visitor has no grant to check a code', `select check_promo_code('WELCOME10')`, 'permission denied');
await db.exec(`reset role;`);

// ---------- Regressions from 20261017-24 (fixed in 20261025) ----------
// A fresh rider, since Bob still has jobs in hand from earlier sections
const rita = await newUser('rita@mail.kmutt.ac.th', 'Rita Rider');
await ready(rita, 'ริต้า', '0867777777', '66070501777');
await db.exec(`insert into rider_roster (email) values ('rita@mail.kmutt.ac.th')`);
await db.exec(`set role anon;`);
ok('a signed-out visitor is not team', (await one(`select is_team() as t`)).t === false);
await expectError('a signed-out visitor cannot add a home banner', `insert into home_banners (id, image_url, title) values ('x', 'https://x/y.png', 'x')`, 'row-level security');
await expectError('a signed-out visitor cannot unlink a store owner', `select admin_unlink_store_owner('kfc-05')`, 'permission denied');
await expectError('a signed-out visitor cannot hand a store over', `select admin_invite_partner('evil@example.com', 'kfc-05')`, 'permission denied');
await expectError('a signed-out visitor cannot save a menu item directly', `select store_save_menu_item('kfc-05', 'team', null, 'x', 'x', 10, null, '', null, true, '[]')`, 'permission denied');
await db.exec(`reset role;`);
await as(alice, () => expectError('a signed-in buyer cannot call the menu helper either', `select store_save_menu_item('kfc-05', 'team', null, 'x', 'x', 10, null, '', null, true, '[]')`, 'permission denied'));
await as(rita, async () => {
	await db.exec(`select set_rider_online(true)`);
	const board = await rpc(`rider_board()`);
	ok('the rider board says the rider is online again', board.online === true);
	ok('board jobs carry tip and store discount again', board.open.concat(board.mine).every((j) => 'tip' in j && 'store_discount' in j));
});
{
	const id = (await as(alice, () => placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }]))).id;
	await db.exec(`update menu_items set options = '[{"id":"g1","name":"ท็อปปิ้ง","choices":[{"id":"c1","name":"ไข่มุก","price":5}]}]' where id = 'kfc-10-1'`);
	await db.exec(`insert into order_items (order_id, menu_item_id, special, name, price, quantity, selected_options)
		values ('${id}', 'kfc-10-1', false, 'x', 23, 1, '[{"groupId":"g1","groupName":"ท็อปปิ้ง","choiceId":"c1","name":"ไข่มุก","price":5}]')`);
	await db.exec(`update menu_items set options = '[]' where id = 'kfc-10-1'`);
	ok('the same item with different options is two lines', Number((await one(`select count(*) n from order_items where order_id = '${id}'`)).n) === 2);
	await as(alice, () => db.exec(`select cancel_order('${id}')`));
}

// ---------- Phone privacy + chat as evidence (20261026) ----------
{
	const id = (await as(alice, () => placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }]))).id;
	await as(rita, () => db.exec(`select accept_order('${id}')`));
	await as(alice, async () => {
		const o = (await rpc(`my_orders('${id}')`))[0];
		ok('the buyer sees their rider but never the rider\'s phone', o.rider?.name && !('phone' in o.rider), JSON.stringify(o.rider));
		await db.exec(`insert into chat_messages (order_id, sender_id, sender_role, body) values ('${id}', '${alice}', 'CUSTOMER', 'อยู่หน้าตึกนะ')`);
	});
	await as(rita, async () => {
		const job = (await rpc(`rider_board()`)).mine.find((j) => j.id === id);
		ok('the rider sees the buyer\'s phone while the job is in hand', job?.customer?.phone === '0811111111', JSON.stringify(job?.customer));
		await db.exec(`select mark_delivering('${id}')`);
	});
	const otp = (await one(`select otp_code from order_secrets where order_id = '${id}'`)).otp_code;
	await as(rita, async () => {
		await db.query(`select confirm_delivery('${id}', '${otp}')`);
		const board = await rpc(`rider_board()`);
		ok('once delivered the buyer and their phone leave the rider\'s board', !board.mine.some((j) => j.id === id) && !JSON.stringify(board).includes('0811111111'));
		ok('the rider can still read the chat after delivery', (await db.query(`select body from chat_messages where order_id = '${id}'`)).rows.some((m) => m.body === 'อยู่หน้าตึกนะ'));
		await expectError('but cannot send into a finished order', `insert into chat_messages (order_id, sender_id, sender_role, body) values ('${id}', '${rita}', 'RIDER', 'x')`, 'row-level security');
	});
	await as(alice, async () => ok('the buyer can still read the chat after delivery', (await db.query(`select 1 from chat_messages where order_id = '${id}'`)).rows.length > 0));
	await as(tina, async () => {
		const chat = await rpc(`admin_order_chat('${id}')`);
		ok('the team reads an order\'s whole chat with who sent it', chat.some((m) => m.body === 'อยู่หน้าตึกนะ' && m.role === 'CUSTOMER' && m.by === 'Alice'), JSON.stringify(chat));
	});
	await as(alice, () => expectError('a buyer cannot read the team chat log', `select admin_order_chat('${id}')`, 'TEAM_ONLY'));
	// A signed-in path that bypasses RLS (a SECURITY DEFINER function, an order delete cascade) still can't erase recent chat
	await db.exec(`select set_config('request.jwt.claim.sub', '${tina}', false)`);
	await expectError('chat younger than 10 days cannot be deleted', `delete from chat_messages where order_id = '${id}'`, 'CHAT_KEPT');
	await db.exec(`update chat_messages set created_at = now() - interval '11 days' where order_id = '${id}'`);
	await db.exec(`delete from chat_messages where order_id = '${id}'`);
	ok('older chat can be cleaned up', Number((await one(`select count(*) n from chat_messages where order_id = '${id}'`)).n) === 0);
	await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
}

// ---------- Web Push (20261027) ----------
// Stand-ins for Vault and pg_net: record what the trigger would send
await db.exec(`
	create schema vault; create table vault.decrypted_secrets (name text, decrypted_secret text);
	create schema net; create table net.sent (url text, body jsonb, headers jsonb);
	create function net.http_post(url text, body jsonb, headers jsonb) returns bigint language sql as $$ insert into net.sent values (url, body, headers) returning 1::bigint $$;
`);
const outbox = async (uid) => (await db.query(`select title, body, tag from push_outbox where user_id = '${uid}' order by id`)).rows;
const sub = (n) => `select save_push_subscription('https://push.example/${n}', 'p256-${n}', 'auth-${n}')`;
await db.exec(`set role anon;`);
await expectError('a signed-out visitor cannot save a push subscription', sub('anon'), 'permission denied');
await db.exec(`reset role;`);
await as(alice, () => db.exec(sub('alice')));
await as(rita, async () => {
	await db.exec(sub('rita'));
	await db.exec(`select set_rider_online(true)`);
	await db.exec(`select remove_push_subscription('https://push.example/alice')`);
});
ok('a user can only remove their own device', Number((await one(`select count(*) n from push_subscriptions where user_id = '${alice}'`)).n) === 1);
await as(bob, () => db.exec(sub('alice')));
ok('a device that signs in as someone else moves to them', (await one(`select user_id from push_subscriptions where endpoint = 'https://push.example/alice'`)).user_id === bob);
await as(alice, () => db.exec(sub('alice')));
await as(alice, async () => ok('the outbox is not readable from the app', (await db.query(`select * from push_outbox`)).rows.length === 0));
{
	await db.exec(`delete from push_outbox`);
	const id = (await as(alice, () => placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }]))).id;
	const ritaGot = await outbox(rita);
	ok('a rider who is switched on hears about a new job', ritaGot.length === 1 && ritaGot[0].title.startsWith('มีงานใหม่') && ritaGot[0].tag === `job-${id}`, JSON.stringify(ritaGot));
	ok('the buyer is not told about their own job', (await outbox(alice)).length === 0);
	ok('nobody without a device gets a row', Number((await one(`select count(*) n from push_outbox where user_id not in ('${alice}', '${rita}')`)).n) === 0);
	ok('without Vault setup nothing is sent', Number((await one(`select count(*) n from net.sent`)).n) === 0);

	await db.exec(`insert into vault.decrypted_secrets values ('push_hook_url', 'https://x.supabase.co/functions/v1/send-push'), ('push_hook_secret', 's3cret')`);
	await as(rita, () => db.exec(`select accept_order('${id}')`));
	const aliceGot = await outbox(alice);
	ok('the buyer is told the rider took the job', aliceGot.length === 1 && aliceGot[0].title === 'ริต้า รับงานหิ้วแล้ว' && aliceGot[0].tag === `order-${id}`, JSON.stringify(aliceGot));
	const sent = (await db.query(`select * from net.sent`)).rows;
	ok('the row goes to send-push with the hook secret', sent.length === 1 && sent[0].url.endsWith('/send-push') && sent[0].headers['x-push-secret'] === 's3cret' && Number.isInteger(sent[0].body.id), JSON.stringify(sent));

	await as(alice, () => db.exec(`insert into chat_messages (order_id, sender_id, sender_role, body) values ('${id}', '${alice}', 'CUSTOMER', 'ฝากซอสเพิ่มด้วย')`));
	const chatPush = (await outbox(rita)).at(-1);
	ok('a buyer message reaches the rider', chatPush.title === 'ข้อความจาก Alice (ผู้ซื้อ)' && chatPush.body === 'ฝากซอสเพิ่มด้วย' && chatPush.tag === `chat-${id}`, JSON.stringify(chatPush));
	await as(rita, () => db.exec(`insert into chat_messages (order_id, sender_id, sender_role, body) values ('${id}', '${rita}', 'RIDER', 'ได้ครับ')`));
	ok('a rider message reaches the buyer', (await outbox(alice)).at(-1).body === 'ได้ครับ');

	await as(rita, () => db.exec(`select mark_delivering('${id}')`));
	ok('the buyer is told the food is on its way', (await outbox(alice)).at(-1).title.includes('กำลังไปส่ง'));
	const otp = (await one(`select otp_code from order_secrets where order_id = '${id}'`)).otp_code;
	await as(rita, () => db.query(`select confirm_delivery('${id}', '${otp}')`));

	// A buyer who cancels is not told what they just did
	await db.exec(`delete from push_outbox`);
	const id2 = (await as(alice, () => placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }]))).id;
	await as(alice, () => db.exec(`select cancel_order('${id2}')`));
	ok('cancelling your own order sends you nothing', (await outbox(alice)).length === 0);
	const bad = await one(`select count(*) n from push_outbox where error is not null`);
	ok('dispatch errors are recorded, not raised', Number(bad.n) === 0);
}
await db.exec(`drop schema net cascade; drop schema vault cascade;`);

// ---------- In-app calls (20261028) ----------
{
	const id = (await as(alice, () => placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 1 }]))).id;
	await as(alice, () => expectError('no call before a rider takes the job', `select start_call('${id}')`, 'CALL_NOT_ALLOWED'));
	await as(rita, () => db.exec(`select accept_order('${id}')`));
	await db.exec(`delete from push_outbox`);
	const callId = await as(alice, async () => (await one(`select start_call('${id}') as c`)).c);
	await as(alice, () => expectError('one call at a time', `select start_call('${id}')`, 'CALL_BUSY'));
	await as(rita, async () => {
		const ring = await rpc(`my_ringing_call()`);
		ok('the rider sees the ring with who is calling', ring?.id === callId && ring.caller_name === 'Alice' && ring.caller_role === 'CUSTOMER', JSON.stringify(ring));
	});
	const ringPush = (await outbox(rita)).at(-1);
	ok('the ring goes out as a push too', ringPush?.title === 'สายเรียกเข้าจาก Alice (ผู้ซื้อ)' && ringPush.tag === `call-${id}`, JSON.stringify(ringPush));
	await as(bob, async () => {
		await expectError('an outsider cannot ring on the order', `select start_call('${id}')`, 'ORDER_NOT_FOUND');
		await expectError('an outsider cannot pick up', `select answer_call('${callId}')`, 'CALL_GONE');
		ok('an outsider cannot see the call', (await db.query(`select * from calls`)).rows.length === 0);
		ok('an outsider cannot join the signalling channel', (await one(`select can_join_call_topic('call:${id}') as ok`)).ok === false);
	});
	await as(alice, async () => {
		ok('the buyer may join the signalling channel', (await one(`select can_join_call_topic('call:${id}') as ok`)).ok === true);
		ok('a malformed topic is refused', (await one(`select can_join_call_topic('call:${id}'' or true') as ok`)).ok === false);
		await expectError('the caller cannot answer their own call', `select answer_call('${callId}')`, 'CALL_GONE');
	});
	await as(rita, () => db.exec(`select answer_call('${callId}')`));
	ok('picking up makes the call active', (await one(`select status from calls where id = '${callId}'`)).status === 'ACTIVE');
	await as(alice, () => db.exec(`select end_call('${callId}')`));
	const chatLines = async () => (await db.query(`select body from chat_messages where order_id = '${id}' and sender_role = 'SYSTEM' order by created_at`)).rows.map((r) => r.body);
	ok('hanging up leaves the length in the chat', (await chatLines()).includes('ผู้ซื้อ โทรผ่านแอป 0:00 นาที'), JSON.stringify(await chatLines()));

	const second = await as(rita, async () => (await one(`select start_call('${id}') as c`)).c);
	await as(alice, () => db.exec(`select end_call('${second}')`));
	ok('declining is recorded', (await one(`select status from calls where id = '${second}'`)).status === 'DECLINED' && (await chatLines()).includes('คนหิ้ว ไม่ได้รับสาย (ปฏิเสธ)'));

	const third = await as(alice, async () => (await one(`select start_call('${id}') as c`)).c);
	await as(rita, () => db.exec(`select mark_delivering('${id}')`));
	ok('a call can ring while the food is on its way', (await one(`select status from calls where id = '${third}'`)).status === 'RINGING');
	const otp = (await one(`select otp_code from order_secrets where order_id = '${id}'`)).otp_code;
	await as(rita, () => db.query(`select confirm_delivery('${id}', '${otp}')`));
	ok('delivering ends a ring nobody answered', (await one(`select status from calls where id = '${third}'`)).status === 'MISSED');
	await as(alice, async () => {
		await expectError('no calls once the order is done', `select start_call('${id}')`, 'CALL_NOT_ALLOWED');
		ok('nor the signalling channel', (await one(`select can_join_call_topic('call:${id}') as ok`)).ok === false);
		ok('the buyer still sees their call history', (await db.query(`select * from calls where order_id = '${id}'`)).rows.length === 3);
	});
	await as(tina, async () => {
		const log = await rpc(`admin_order_calls('${id}')`);
		ok('the team sees every call on the order', log.length === 3 && log[0].status === 'ENDED' && log[0].seconds === 0 && log[1].status === 'DECLINED', JSON.stringify(log));
	});
	await as(alice, () => expectError('a buyer cannot read the team call log', `select admin_order_calls('${id}')`, 'TEAM_ONLY'));
}

// ---------- Security review fixes (20261029) ----------
await as(alice, async () => {
	await expectError('a student cannot unlink a store owner', `select admin_unlink_store_owner('kfc-05')`, 'TEAM_ONLY');
	await expectError('nor hand a store to someone', `select admin_invite_partner('alice@kmutt.ac.th', 'kfc-05')`, 'TEAM_ONLY');
	await expectError('a student cannot claim a store without an invite', `select partner_claim_store('kfc-03')`, 'CLAIM_NEEDS_INVITE');
	await expectError('nor one that has an owner', `select partner_claim_store('kfc-05')`, 'STORE_ALREADY_OWNED');
});
ok('the ownerless store stays ownerless', (await one(`select owner_id from stores where id = 'kfc-03'`)).owner_id === null);
{
	const owner = await newUser('stall.owner@mail.kmutt.ac.th', 'Stall Owner');
	await db.exec(`insert into partner_invites (email, store_id) values ('stall.owner@mail.kmutt.ac.th', 'kfc-03')`);
	await as(owner, () => db.exec(`select partner_claim_store('kfc-03')`));
	ok('an invited owner claims their store', (await one(`select owner_id from stores where id = 'kfc-03'`)).owner_id === owner && Number((await one(`select count(*) n from partner_invites where email = 'stall.owner@mail.kmutt.ac.th'`)).n) === 0);
	await as(tina, () => db.exec(`select admin_unlink_store_owner('kfc-03')`));
}
{
	const shop = await newUser('new.shop@mail.kmutt.ac.th', 'New Shop');
	const sid = await as(shop, async () => (await one(`select partner_register_store('ร้านใหม่ทดสอบ', 'อาหารตามสั่ง', 'no-such-zone', '') as id`)).id);
	const row = await one(`select hidden, is_open from stores where id = '${sid}'`);
	ok('a self-registered store starts hidden and closed', row.hidden === true && row.is_open === false);
	await as(shop, () => expectError('and its owner cannot open it before the team looks', `select partner_set_store_open(true)`, 'STORE_PENDING_REVIEW'));
	await as(alice, async () => ok('buyers do not see it', (await db.query(`select 1 from stores where id = '${sid}'`)).rows.length === 0));
	await db.exec(`update stores set is_open = true where id = '${sid}'`);
	ok('a hidden store can never be open, whoever tries', (await one(`select is_open from stores where id = '${sid}'`)).is_open === false);
	await as(tina, () => db.exec(`select admin_set_store_hidden('${sid}', false)`));
	await as(shop, () => db.exec(`select partner_set_store_open(true)`));
	ok('once the team shows it, the owner can open it', (await one(`select is_open from stores where id = '${sid}'`)).is_open === true);
	await as(tina, () => db.exec(`select admin_set_store_hidden('${sid}', true)`));
}
{
	// kfc-10-1 gets a topping group: one choice at most, 5 baht
	await db.exec(`update menu_items set options = '[{"id":"g1","name":"ท็อปปิ้ง","maxChoices":1,"choices":[{"id":"c1","name":"ไข่มุก","price":5},{"id":"c2","name":"วุ้น","price":0}]},{"id":"g2","name":"ความหวาน","required":true,"choices":[{"id":"s1","name":"หวานน้อย","price":0}]}]' where id = 'kfc-10-1'`);
	const opt = (choiceId, name, price, groupId = 'g1') => ({ groupId, groupName: 'x', choiceId, name, price });
	const sweet = opt('s1', 'หวานน้อย', 0, 'g2');
	const line = (options) => [{ menu_item_id: 'kfc-10-1', quantity: 1, selected_options: options }];
	await as(alice, async () => {
		const good = await orderRow((await placeOrder('kfc-10', line([opt('c1', 'ไข่มุก', 5), sweet]))).id);
		ok('a real option is charged at the menu price', good.food_total === 23, String(good.food_total));
		await db.exec(`select cancel_order('${good.id}')`);
		const tries = [
			['a paid option sent as free is refused', [opt('c1', 'ไข่มุก', 0), sweet]],
			['a made-up option name is refused', [opt('c2', 'ไข่ดาว x3, หมูกรอบ', 0), sweet]],
			['an option that is not on the menu is refused', [opt('zz', 'ชีส', 0), sweet]],
			['two choices in a pick-one group are refused', [opt('c1', 'ไข่มุก', 5), opt('c2', 'วุ้น', 0), sweet]],
			['the same choice twice is refused', [opt('c2', 'วุ้น', 0), opt('c2', 'วุ้น', 0), sweet]],
			['a required group left empty is refused', [opt('c1', 'ไข่มุก', 5)]]
		];
		for (const [label, options] of tries) await expectError(label, `select place_order_at('kfc-10', '${JSON.stringify(line(options))}'::jsonb, 'sit', 1, '', 'CASH', null)`, 'OPTION_CHANGED');
	});
	await db.exec(`update menu_items set options = '[]' where id = 'kfc-10-1'`);
}

// ---------- Sign-up guard (20261030) ----------
{
	const signUp = (email, user, app) =>
		`insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values ('${email}', '${JSON.stringify(user)}', '${JSON.stringify(app)}')`;
	const TENANT = '6f4432dc-20d2-441d-b1db-ac3380ba633d';
	await expectError('email + password sign-up is refused even with a KMUTT address', signUp('fake1@kmutt.ac.th', { email_verified: false }, { provider: 'email' }), 'OAUTH_ONLY');
	await expectError('a provider that did not verify the email is refused', signUp('fake2@kmutt.ac.th', { email_verified: false }, { provider: 'google' }), 'EMAIL_UNVERIFIED');
	await expectError('Microsoft from another tenant is refused', signUp('fake3@kmutt.ac.th', { email_verified: true, custom_claims: { tid: '00000000-0000-0000-0000-000000000000' } }, { provider: 'azure' }), 'KMUTT_TENANT_ONLY');
	await expectError('a KMUTT name in an unverified claim no longer counts', `insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values ('', '{"email":"fake4@kmutt.ac.th","email_verified":true}', '{"provider":"azure"}')`, 'KMUTT_ONLY');
	await db.exec(signUp('real.ms@kmutt.ac.th', { email_verified: true, custom_claims: { tid: TENANT } }, { provider: 'azure' }));
	ok('Microsoft from the KMUTT tenant signs up', (await one(`select p.role from profiles p join auth.users u on u.id = p.id where u.email = 'real.ms@kmutt.ac.th'`))?.role === 'STUDENT');
	ok('nothing was created for the refused ones', Number((await one(`select count(*) n from profiles where email like 'fake%'`)).n) === 0);

	// Flood: 3 per minute for this test
	await db.exec(`update app_settings set value = '3' where key = 'signup_limit_per_minute'; update auth.users set created_at = now() - interval '2 hours'`);
	for (let i = 1; i <= 3; i++) await db.exec(signUp(`burst${i}@mail.kmutt.ac.th`, { email_verified: true }, { provider: 'google' }));
	await expectError('the 4th new account within a minute is refused', signUp('burst4@mail.kmutt.ac.th', { email_verified: true }, { provider: 'google' }), 'SIGNUP_BUSY');
	await db.exec(`insert into team_members (email, role) values ('helper.team@gmail.com', 'STAFF')`);
	await db.exec(signUp('helper.team@gmail.com', { email_verified: true }, { provider: 'google' }));
	ok('a team member still gets in during a flood', Number((await one(`select count(*) n from profiles where email = 'helper.team@gmail.com'`)).n) === 1);
	await db.exec(`update auth.users set created_at = now() - interval '2 minutes' where email like 'burst%'`);
	await db.exec(signUp('burst4@mail.kmutt.ac.th', { email_verified: true }, { provider: 'google' }));
	ok('a minute later sign-ups open again', Number((await one(`select count(*) n from profiles where email = 'burst4@mail.kmutt.ac.th'`)).n) === 1);
	await db.exec(`update app_settings set value = '1000' where key = 'signup_limit_per_minute'`);
}

// ---------- Store open / closed (20261031) ----------
{
	// 1. The weekly schedule: the same cases the app's unit test runs (src/lib/operatingHours.test.ts)
	for (const c of OPEN_CASES) {
		const h = c.hours ? `'${JSON.stringify(c.hours)}'::jsonb` : 'null::jsonb';
		const r = await one(`select store_schedule_open(${h}, '${c.at}') o, to_char(store_schedule_next(${h}, '${c.at}') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') n`);
		ok(`schedule: ${c.name}`, r.o === c.open && r.n === c.next, JSON.stringify(r));
	}

	// 2. What a screen may send
	const bad = (label, hours) => expectError(label, `select store_hours_normalize('${JSON.stringify(hours)}'::jsonb)`, 'BAD_HOURS');
	await bad('hours: opening = closing is refused', { enabled: true, openTime: '08:00', closeTime: '08:00' });
	await bad('hours: 25:00 is not a time', { enabled: true, openTime: '25:00', closeTime: '08:00' });
	await bad('hours: "8:00" without a leading zero is refused', { enabled: true, openTime: '8:00', closeTime: '17:00' });
	await bad('hours: day 7 does not exist', { enabled: true, openTime: '08:00', closeTime: '17:00', days: [1, 7] });
	await bad('hours: enabled with no days is refused', { enabled: true, openTime: '08:00', closeTime: '17:00', days: [] });
	await bad('hours: "enabled" must be true or false', { enabled: 'yes', openTime: '08:00', closeTime: '17:00' });
	ok('hours: all seven days are stored as "every day", sorted and unique',
		JSON.stringify(await rpc(`store_hours_normalize('{"enabled":true,"openTime":"08:00","closeTime":"17:00","days":[6,5,4,3,2,1,0,0]}'::jsonb)`)) === JSON.stringify({ enabled: true, openTime: '08:00', closeTime: '17:00' }));

	// 3. Both sides drive the same store: Panee (owner of kfc-05), Sam (STAFF), Tina (ADMIN)
	const bkk = new Date(Date.now() + 7 * 3600_000);
	const at = (mins) => new Date(bkk.getTime() + mins * 60_000).toISOString().slice(11, 16);
	const inside = { enabled: true, openTime: at(-30), closeTime: at(30) };
	const outside = { enabled: true, openTime: at(120), closeTime: at(180) };
	const status = (who) => as(who, () => rpc(who === panee ? `partner_store_open_status()` : `admin_store_open_status('kfc-05')`));
	const saveHours = (who, h, rev = 'null') => as(who, () => rpc(who === panee ? `partner_set_operating_hours('${JSON.stringify(h)}'::jsonb, ${rev})` : `admin_set_store_hours('kfc-05', '${JSON.stringify(h)}'::jsonb, ${rev})`));
	const isOpen = async () => (await one(`select is_open from stores where id = 'kfc-05'`)).is_open;
	const order = () => `select place_order_at('kfc-05', '[{"menu_item_id":"kfc-05-1","quantity":1}]'::jsonb, 'sit', 1, null, 'CASH', null)`;

	let st = await status(panee);
	ok('the owner starts with a hand-switched store that is open', st.is_open === true && st.source === 'OVERRIDE' && st.override.value === 'OPEN' && st.override.until === null, JSON.stringify(st));

	st = await saveHours(panee, outside);
	ok('the owner turns a schedule on outside the hours: the clock takes over and closes it', st.is_open === false && st.source === 'SCHEDULE' && st.override === null && st.schedule_open === false && !!st.next_change, JSON.stringify(st));
	ok('the stored flag followed', (await isOpen()) === false);
	await as(alice, () => expectError('and a buyer cannot order', order(), 'STORE_UNAVAILABLE'));

	st = await as(panee, () => rpc(`partner_set_store_open(true)`));
	const until = Date.parse(st.override?.until);
	ok('opening outside the hours is allowed for 4 hours, then it ends', st.is_open === true && st.source === 'OVERRIDE' && until > Date.now() + 3.9 * 3600_000 && until < Date.now() + 4.1 * 3600_000, JSON.stringify(st.override));
	const placed = await as(alice, async () => {
		const o = await one(`${order()} as id`);
		await db.exec(`select cancel_order('${o.id}')`);
		return true;
	});
	ok('the buyer can order now', placed === true);

	// The team locks it: the owner's page cannot undo that
	st = await as(sam, () => rpc(`admin_set_store_open('kfc-05', false, 'ร้านไม่ตอบ โทรไม่ติด')`));
	ok('the team closes it: locked, with the reason', st.is_open === false && st.source === 'TEAM_LOCK' && st.lock.reason === 'ร้านไม่ตอบ โทรไม่ติด' && st.lock.by === 'แซม', JSON.stringify(st.lock));
	await as(panee, () => expectError('the owner cannot reopen a store the team locked', `select partner_set_store_open(true)`, 'STORE_LOCKED'));
	st = await status(panee);
	ok('the owner is told why, but not by whom', st.lock?.reason === 'ร้านไม่ตอบ โทรไม่ติด' && !('by' in st.lock), JSON.stringify(st.lock));
	ok('and the schedule keeps working underneath', st.schedule_open === false);
	st = await saveHours(panee, inside);
	ok('the owner may still edit the schedule while locked, and stays closed', st.is_open === false && st.source === 'TEAM_LOCK');
	await as(alice, () => expectError('a locked store takes no orders', order(), 'STORE_UNAVAILABLE'));

	st = await as(sam, () => rpc(`admin_release_store_open('kfc-05', true)`));
	ok('the team releases the lock and the store follows its schedule (now inside the hours)', st.is_open === true && st.source === 'SCHEDULE' && st.lock === null && st.override === null, JSON.stringify(st));

	// Inside the hours the owner closes by hand: until the schedule next changes, then back to normal
	st = await as(panee, () => rpc(`partner_set_store_open(false)`));
	const closeAt = Date.parse(st.override?.until);
	ok('the owner closes during the hours: closed until the closing time', st.is_open === false && st.source === 'OVERRIDE' && closeAt > Date.now() + 25 * 60_000 && closeAt < Date.now() + 35 * 60_000, JSON.stringify(st.override));
	ok('tomorrow the same override no longer applies (the schedule opens it again)',
		(await one(`select store_open_calc('kfc-05', false, null, '${JSON.stringify(inside)}'::jsonb, false, now() + interval '1 day') as o`)).o === true);
	st = await as(panee, () => rpc(`partner_follow_schedule()`));
	ok('"follow the schedule" drops the hand switch', st.is_open === true && st.source === 'SCHEDULE' && st.override === null);

	// Two screens at once: a stale rev is refused, not applied over the top
	const stale = (await status(panee)).rev;
	await as(sam, () => rpc(`admin_set_store_hours('kfc-05', '${JSON.stringify(inside)}'::jsonb, ${stale})`));
	await as(panee, () => expectError('a screen that missed the team\'s change is told so', `select partner_set_store_open(false, null, ${stale})`, 'STORE_STATE_CHANGED'));
	await as(sam, () => expectError('the team too', `select admin_set_store_hours('kfc-05', '${JSON.stringify(outside)}'::jsonb, ${stale})`, 'STORE_STATE_CHANGED'));

	// Turning the schedule off keeps the store exactly as it is at that moment
	st = await saveHours(panee, { ...inside, enabled: false });
	ok('switching the schedule off freezes the current state', st.is_open === true && st.source === 'OVERRIDE' && st.override.until === null && st.schedule.enabled === false, JSON.stringify(st));
	ok('and it does not flip a day later', (await one(`select store_open_calc('kfc-05', false, null, null, true, now() + interval '3 days') as o`)).o === true);
	await as(sam, () => expectError('the team cannot set impossible hours', `select admin_set_store_hours('kfc-05', '{"enabled":true,"openTime":"09:00","closeTime":"09:00"}'::jsonb)`, 'BAD_HOURS'));

	// The log shows who did what
	await as(tina, async () => {
		const log = (await rpc(`admin_activity()`)).filter((l) => l.target_id === 'kfc-05');
		const has = (action, by) => log.some((l) => l.action === action && (by === undefined || l.detail?.by === by));
		ok('the activity log records the lock, the release, the hours and the hand switches',
			has('STORE_LOCKED') && has('STORE_UNLOCKED') && has('STORE_OPERATING_HOURS_UPDATED', 'team') && has('STORE_OPERATING_HOURS_UPDATED', 'partner') && has('STORE_OPENED', 'partner') && has('STORE_CLOSED', 'partner') && has('STORE_FOLLOW_SCHEDULE'));
	});

	// Locks that run out, and a stored flag that fell behind
	await as(sam, () => rpc(`admin_set_store_open('kfc-05', false, 'พักร้าน', now() + interval '1 hour')`));
	ok('a lock with an end time closes the store', (await isOpen()) === false);
	await db.exec(`update store_open_control set lock_until = now() - interval '1 minute' where store_id = 'kfc-05'`);
	ok('once it has run out the store is open again even before the clock job runs (orders ask fresh)', (await one(`select store_open_now('kfc-05') as o`)).o === true);
	ok('the clock job brings the stored flag and the record up to date', Number((await one(`select refresh_all_store_open() as n`)).n) >= 1 && (await isOpen()) === true && (await one(`select locked from store_open_control where store_id = 'kfc-05'`)).locked === false);
	await as(sam, () => expectError('a lock must end in the future', `select admin_set_store_open('kfc-05', false, 'x', now() - interval '1 hour')`, 'BAD_UNTIL'));
	await as(sam, () => rpc(`admin_release_store_open('kfc-05')`));

	// A stale stored flag never lets an order through
	await db.exec(`update store_open_control set locked = true, lock_until = null where store_id = 'kfc-05'`);
	ok('(the flag still says open)', (await isOpen()) === true);
	await as(alice, () => expectError('an order checks the decision itself, not the stored flag', order(), 'STORE_UNAVAILABLE'));
	await db.exec(`update store_open_control set locked = false where store_id = 'kfc-05'; select refresh_store_open('kfc-05')`);

	// Hand-run SQL on is_open is kept, as a team override, not silently undone
	await db.exec(`update stores set is_open = false where id = 'kfc-05'`);
	let row = await one(`select s.is_open, c.override, c.override_by_name from stores s join store_open_control c on c.store_id = s.id where s.id = 'kfc-05'`);
	ok('UPDATE stores SET is_open = false sticks, recorded as a team override', row.is_open === false && row.override === 'CLOSED' && row.override_by_name === 'SQL', JSON.stringify(row));
	await db.exec(`update stores set is_open = true where id = 'kfc-05'`);
	ok('and true opens it again', (await isOpen()) === true);

	// Who may do what
	await as(alice, () => expectError('a buyer cannot use the team controls', `select admin_set_store_open('kfc-05', false)`, 'TEAM_ONLY'));
	await as(alice, () => expectError('nor the owner ones', `select partner_set_store_open(true)`, 'PARTNER_ONLY'));
	await as(sam, () => expectError('a team member is not the owner', `select partner_follow_schedule()`, 'PARTNER_ONLY'));
	await db.exec(`set role anon;`);
	await expectError('a signed-out visitor cannot read the open state of a store', `select store_open_status('kfc-05')`, 'permission denied');
	await expectError('nor change it', `select admin_set_store_open('kfc-05', false)`, 'permission denied');
	await db.exec(`reset role;`);
	await as(panee, () => expectError('the owner cannot read the team list', `select admin_store_open_states()`, 'TEAM_ONLY'));
	await as(sam, async () => {
		const states = await rpc(`admin_store_open_states()`);
		ok('the team list covers every live store with its source', states.length >= 12 && states.every((x) => x.source) && states.find((x) => x.store_id === 'kfc-05').source === 'OVERRIDE');
	});
	await as(panee, () => expectError('a schedule for a store that has none cannot be "followed"', `select partner_follow_schedule()`, 'NO_SCHEDULE'));
	const hid = (await one(`select id from stores where hidden and deleted_at is null limit 1`))?.id;
	await as(tina, () => expectError('opening a hidden store is refused', `select admin_set_store_open('${hid}', true)`, 'STORE_HIDDEN'));
}

// ---------- Slip queue and unpaid-order limits (20261102) ----------
{
	// Fresh buyer so earlier tests' unpaid orders do not count against the cap
	const quinn = await newUser('quinn@mail.kmutt.ac.th', 'Quinn Buyer');
	await ready(quinn, 'Quinn', '0891234501', '6501234501');
	await db.exec(`update stores set is_open = true where id = 'kfc-01'`);
	const pp = () => as(quinn, () => placeOrder('kfc-01', [{ menu_item_id: 'kfc-01-1', quantity: 1 }], null, 'PROMPTPAY'));
	const o1 = (await pp()).id;
	const o2 = (await pp()).id;
	const o3 = (await pp()).id;
	await as(quinn, () => expectError('a 4th unpaid PromptPay order is refused', `select place_order_at('kfc-01', '[{"menu_item_id":"kfc-01-1","quantity":1}]'::jsonb, 'sit', 1, null, 'PROMPTPAY', null)`, 'TOO_MANY_UNPAID'));
	ok('cash orders are not limited by unpaid PromptPay ones', !!(await as(quinn, () => placeOrder('kfc-01', [{ menu_item_id: 'kfc-01-1', quantity: 1 }]))).id);

	// the queue
	const sid = (await one(`select gen_random_uuid() as id`)).id;
	await db.exec(`select slip_enqueue('${sid}', '${o1}', '${quinn}', 'q/1.png')`);
	await expectError('a second slip while one is queued is refused', `select slip_enqueue(gen_random_uuid(), '${o1}', '${quinn}', 'q/2.png')`, 'SLIP_ALREADY_QUEUED');
	await expectError("nobody queues a slip for another buyer's order", `select slip_enqueue(gen_random_uuid(), '${o1}', '${alice}', 'q/3.png')`, 'ORDER_NOT_FOUND');
	ok('the buyer sees the slip as queued', (await as(quinn, () => one(`select my_slip_status('${o1}') as s`))).s.status === 'QUEUED');
	ok('another buyer sees nothing', (await as(alice, () => one(`select my_slip_status('${o1}') as s`))).s === null);
	ok('a queued slip is claimed once', (await one(`select slip_claim('${sid}', 4) as c`)).c === true && (await one(`select slip_claim('${sid}', 4) as c`)).c === false);
	await db.exec(`select slip_finish('${sid}', 'REJECTED', 'SLIP_INVALID', null)`);
	for (let i = 0; i < 4; i++) {
		const id = (await one(`select gen_random_uuid() as id`)).id;
		await db.exec(`select slip_enqueue('${id}', '${o1}', '${quinn}', 'q/r${i}.png'); select slip_claim('${id}', 4); select slip_finish('${id}', 'REJECTED', 'SLIP_INVALID', null)`);
	}
	await expectError('after 5 rejected slips the buyer must ask the team', `select slip_enqueue(gen_random_uuid(), '${o1}', '${quinn}', 'q/z.png')`, 'TOO_MANY_ATTEMPTS');

	// SlipOK down three times, then a person looks
	const sid2 = (await one(`select gen_random_uuid() as id`)).id;
	await db.exec(`select slip_enqueue('${sid2}', '${o2}', '${quinn}', 'q/s.png')`);
	for (let i = 0; i < 3; i++) await db.exec(`select slip_claim('${sid2}', 4); select slip_finish('${sid2}', 'QUEUED', 'SLIPOK_UNAVAILABLE', null)`);
	ok('after 3 failed tries the slip waits for the team', (await one(`select status from slip_submissions where id = '${sid2}'`)).status === 'NEEDS_REVIEW');
	ok('and the order is flagged for the team', (await one(`select order_attention(o, 0) @> '[{"code":"SLIP_REVIEW"}]'::jsonb as f from orders o where id = '${o2}'`)).f === true);
	await expectError('no new slip while the team is reviewing', `select slip_enqueue(gen_random_uuid(), '${o2}', '${quinn}', 'q/y.png')`, 'SLIP_UNDER_REVIEW');

	// a slip stuck mid-check is not repeated blindly
	const sid3 = (await one(`select gen_random_uuid() as id`)).id;
	await db.exec(`insert into slip_submissions (id, order_id, customer_id, image_path, status, claimed_at) values ('${sid3}', '${o3}', '${quinn}', 'q/stale.png', 'CHECKING', now() - interval '5 minutes')`);
	ok('a slip stuck in CHECKING is not claimed again', (await one(`select slip_claim('${sid3}', 4) as c`)).c === false);
	ok('it goes to the team instead', (await one(`select status || '/' || error_code as s from slip_submissions where id = '${sid3}'`)).s === 'NEEDS_REVIEW/STUCK');

	// the money gap: SlipOK accepted a slip for an order the buyer cancelled meanwhile
	await as(quinn, () => db.exec(`select cancel_order('${o1}')`));
	ok('a slip for a cancelled order is booked as a refund, not lost', (await one(`select record_slip_payment('${o1}', 'REF-LATE', (select total_price from orders where id = '${o1}')) as r`)).r === 'REFUND_DUE');
	await as(tina, async () => {
		ok('and the order is in the refund list', (await rpc(`admin_refunds_due()`)).some((r) => r.order_id === o1));
	});
	await expectError('the same order cannot be paid twice', `select record_slip_payment('${o1}', 'REF-LATE2', (select total_price from orders where id = '${o1}'))`, 'ALREADY_PAID');

	// expiry
	await db.exec(`update orders set created_at = now() - interval '30 minutes' where id = '${o2}'`);
	ok('an order whose slip waits for the team does not expire', (await one(`select expire_unpaid_orders(null) as n`)).n === 0);
	const o4 = (await as(quinn, () => placeOrder('kfc-01', [{ menu_item_id: 'kfc-01-1', quantity: 1 }], null, 'PROMPTPAY'))).id;
	await db.exec(`update orders set created_at = now() - interval '30 minutes' where id = '${o4}'`);
	ok('an unpaid PromptPay order expires after 20 minutes', (await one(`select expire_unpaid_orders(null) as n`)).n === 1 && (await one(`select status from orders where id = '${o4}'`)).status === 'CANCELLED');

	// who may call what
	await as(quinn, () => expectError('a buyer cannot queue slips directly', `select slip_enqueue(gen_random_uuid(), '${o4}', '${quinn}', 'x')`, 'permission denied'));
	await as(quinn, () => expectError('a buyer cannot finish a slip as PAID', `select slip_finish('${sid2}', 'PAID', null, null)`, 'permission denied'));
	await as(quinn, () => expectError('a buyer cannot record payments', `select record_slip_payment('${o4}', 'FAKE', 40)`, 'permission denied'));
}

// Anonymous visitors can browse the catalogue
await db.exec(`set role anon;`);
ok('anon can read stores', Number((await one(`select count(*) n from stores`)).n) === 12);
await db.exec(`reset role;`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
