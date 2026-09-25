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
const placeOrder = (store, items, code = null) =>
	one(`select place_order('${store}', '${JSON.stringify(items)}'::jsonb, 'อาคาร SIT ชั้น 1', 'โต๊ะหน้าลิฟต์', 'PROMPTPAY', ${code ? `'${code}'` : 'null'}) as id`);
const orderRow = (id) => one(`select * from orders where id = '${id}'`);

// ---------- Profile is asked for at the first order, not at sign-in ----------
const cp = (args) => `select complete_profile(${args.map((v) => (v === null ? 'null' : `'${v}'`)).join(', ')})`;
/** Fill in a student's profile, as the app does before their first order */
const ready = (uid, nickname, phone, studentId) => as(uid, () => db.exec(cp([nickname, phone, null, studentId, 'คณะวิทยาศาสตร์', '2', '2026-09'])));
await as(alice, async () => {
	await expectError('no order before the profile is filled in', `select place_order('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1}]', 'อาคาร SIT ชั้น 1', '', 'CASH', null)`, 'PROFILE_REQUIRED');
	await expectError('no ฝากซื้อ before the profile is filled in', `select place_custom_order('เซเว่นหน้าหอใน มจธ.', 'นมจืด 2 กล่อง', 30, 'อาคาร SIT ชั้น 1', null)`, 'PROFILE_REQUIRED');
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
		`select place_order('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1}]', 'x', '', 'CASH', 'KMUTTFIRST')`,
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
	await expectError('พิเศษ refused for a one-size item', `select place_order('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1,"special":true}]', 'x', '', 'CASH', null)`, 'ITEM_UNAVAILABLE');
	await expectError('duplicate พิเศษ lines refused', `select place_order('kfc-05', '[{"menu_item_id":"kfc-05-4","quantity":1,"special":true},{"menu_item_id":"kfc-05-4","quantity":1,"special":true}]', 'x', '', 'CASH', null)`, 'ITEM_UNAVAILABLE');
	const mine = (await one(`select my_orders('${o4.id}') as j`)).j[0];
	ok('my_orders reports the size', mine.items.some((i) => i.special === true) && mine.items.some((i) => i.special === false));

	// Prices come from the database, whatever the client believes
	await expectError('sold-out item refused', `select place_order('kfc-04', '[{"menu_item_id":"kfc-04-8","quantity":1}]', 'x', '', 'CASH', null)`, 'ITEM_UNAVAILABLE');
	await expectError('item from another store refused', `select place_order('kfc-10', '[{"menu_item_id":"kfc-05-4","quantity":1}]', 'x', '', 'CASH', null)`, 'ITEM_UNAVAILABLE');
	await expectError('duplicate lines refused', `select place_order('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1},{"menu_item_id":"kfc-10-1","quantity":1}]', 'x', '', 'CASH', null)`, 'ITEM_UNAVAILABLE');
	await expectError('quantity 0 refused', `select place_order('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":0}]', 'x', '', 'CASH', null)`, 'BAD_QUANTITY');
	await expectError('unknown promo code refused', `select place_order('kfc-10', '[{"menu_item_id":"kfc-10-1","quantity":1}]', 'x', '', 'CASH', 'FREEMONEY')`, 'PROMO_INVALID');

	const c = await orderRow((await one(`select place_custom_order('เซเว่นหน้าหอใน', 'นมจืด 2 กล่อง', 45, 'หอ S6', '') as id`)).id);
	ok('custom order total = estimate + 20', c.total_price === 65 && c.kind === 'CUSTOM');
	await expectError('custom over 1000 refused', `select place_custom_order('x', 'ของเยอะ', 1500, 'y', '')`, 'BAD_PRICE');

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
	ok('rating + tip saved', r.rating === 5 && r.tip === 10);
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
	const co = await one(`insert into promotions (store_id, kind, title, free_delivery) values ('kfc-05', 'CO_PROMO', 'ห่านหิ้วฟรี', true) returning id, approved`);
	ok('CO_PROMO waits for approval', co.approved === false);
	await db.exec(`update promotions set approved = true where id = '${co.id}'`);
	ok('self-approve attempt ignored', (await one(`select approved from promotions where id = '${co.id}'`)).approved === false);

	await expectError('partner cannot touch another store', `insert into promotions (store_id, kind, title, discount) values ('kfc-10', 'DEAL', 'แอบลด', 50)`);
	await expectError('no benefit = refused', `insert into promotions (store_id, kind, title) values ('kfc-05', 'DEAL', 'ไม่มีอะไร')`, 'promotions_has_benefit');
});

// Admin approves the co-promo; partner edits terms → back to review
await db.exec(`update promotions set approved = true where title = 'ห่านหิ้วฟรี'`);
await as(panee, async () => {
	await db.exec(`update promotions set active = false where title = 'ห่านหิ้วฟรี'`);
	ok('toggling active keeps approval', (await one(`select approved from promotions where title = 'ห่านหิ้วฟรี'`)).approved === true);
	await db.exec(`update promotions set discount = 30 where title = 'ห่านหิ้วฟรี'`);
	ok('editing terms sends it back for review', (await one(`select approved from promotions where title = 'ห่านหิ้วฟรี'`)).approved === false);
});
await as(alice, async () => {
	ok('buyers do not see unapproved promos', Number((await one(`select count(*) n from promotions where title = 'ห่านหิ้วฟรี'`)).n) === 0);
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

// Anonymous visitors can browse the catalogue
await db.exec(`set role anon;`);
ok('anon can read stores', Number((await one(`select count(*) n from stores`)).n) === 12);
await db.exec(`reset role;`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
