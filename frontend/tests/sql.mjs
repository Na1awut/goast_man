// Runs the real migration + seed on PGlite (Postgres in WASM) with minimal
// stand-ins for Supabase's auth/storage schemas, then exercises the rules.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
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
	create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
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
`);

// ---------- Sign-up rules ----------
const newUser = async (email, name = 'Test User') =>
	(await one(`insert into auth.users (email, raw_user_meta_data) values ('${email}', '{"full_name":"${name}"}') returning id`)).id;

const alice = await newUser('alice@mail.kmutt.ac.th', 'Alice Wong');
const bob = await newUser('bob@kmutt.ac.th', 'Bob Rider');
const carl = await newUser('carl@mail.kmutt.ac.th', 'Carl Other');
ok('student profile created', (await one(`select role, nickname from profiles where id = '${alice}'`)).role === 'STUDENT');
// Bob and Carl run errands in the lifecycle tests below
await db.exec(`insert into rider_roster (email) values ('bob@kmutt.ac.th'), ('carl@mail.kmutt.ac.th')`);
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
	// kfc-10-1 ส้มปั่น 18 ฿. 2 cups: 36 food + 15 fee - 10 (DEAL min 2) - 15 KMUTTFIRST = 26
	const o1 = await orderRow((await placeOrder('kfc-10', [{ menu_item_id: 'kfc-10-1', quantity: 2 }], 'KMUTTFIRST')).id);
	ok('first order KMUTTFIRST accepted', o1.code_discount === 15);
	ok('2 drinks → deal 10, total 26', o1.partner_discount === 10 && o1.total_price === 26, `total=${o1.total_price}`);

	await expectError(
		'KMUTTFIRST refused on 2nd order',
		`select place_order_at('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1}]', 'sit', 1, '', 'CASH', 'KMUTTFIRST')`,
		'PROMO_NOT_ELIGIBLE'
	);

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
	await expectError('duplicate พิเศษ lines refused', `select place_order_at('kfc-05', '[{"menu_item_id":"kfc-05-4","quantity":1,"special":true},{"menu_item_id":"kfc-05-4","quantity":1,"special":true}]', 'sit', 1, '', 'CASH', null)`, 'ITEM_UNAVAILABLE');
	const mine = (await one(`select my_orders('${o4.id}') as j`)).j[0];
	ok('my_orders reports the size', mine.items.some((i) => i.special === true) && mine.items.some((i) => i.special === false));

	// Prices come from the database, whatever the client believes
	await expectError('sold-out item refused', `select place_order_at('kfc-04', '[{"menu_item_id":"kfc-04-8","quantity":1}]', 'sit', 1, '', 'CASH', null)`, 'ITEM_UNAVAILABLE');
	await expectError('item from another store refused', `select place_order_at('kfc-10', '[{"menu_item_id":"kfc-05-4","quantity":1}]', 'sit', 1, '', 'CASH', null)`, 'ITEM_UNAVAILABLE');
	await expectError('duplicate lines refused', `select place_order_at('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1},{"menu_item_id":"kfc-10-1","quantity":1}]', 'sit', 1, '', 'CASH', null)`, 'ITEM_UNAVAILABLE');
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
	await expectError('a store with an owner cannot be invited again', `select admin_invite_partner('other@example.com', 'kfc-05')`, 'STORE_HAS_OWNER');
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
	const expected = ['PAYMENT_CONFIRMED', 'OTP_UNLOCKED', 'ORDER_REQUEUED', 'ORDER_CANCELLED', 'REFUNDED', 'PAYOUT_PAID', 'STORE_CLOSED', 'ITEM_OFF', 'RIDER_ADDED', 'PROMO_OFF', 'PARTNER_INVITED', 'MEMBER_ADDED'];
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
await db.exec(`insert into rider_roster (email) values ('bob@kmutt.ac.th'); update rider_presence set online = false where rider_id = '${bob}'`);

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
await as(kai, async () => ok('taken off the team, the console closes', (await rpc(`team_me()`)) === null));

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

// Anonymous visitors can browse the catalogue
await db.exec(`set role anon;`);
ok('anon can read stores', Number((await one(`select count(*) n from stores`)).n) === 12);
await db.exec(`reset role;`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
