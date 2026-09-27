-- ============================================================
-- Delivery fee by distance, floor and rain; at most 5 items per order
--
-- Store orders:  15 ฿ when the store's canteen is within 300 m of the
--                drop-off (straight line on the campus map), 20 ฿ beyond
--                + 1 ฿ per floor above the first, together never above 25 ฿
--                + 5 ฿ while the team has "ฝนตก" switched on (STAFF or ADMIN)
-- ฝากซื้อ:       20 ฿ + the same floor and rain charges
-- A rider carries at most 5 items: an order holds at most 5 (quantities added up).
--
-- The fee is worked out here when the order is placed; the app only shows the
-- same quote. Orders go through place_order_at / place_custom_order_at, which
-- take the drop-off point and floor; the old functions are no longer callable
-- from the app (they could not know the floor).
-- ============================================================

-- Where canteens and drop-off points are (mirrors frontend/src/lib/routing/places.ts
-- and data/locations.ts; measured from the KMUTT master plan)
create table public.campus_places (
	id text primary key,
	name text not null default '',
	lat double precision not null,
	lng double precision not null,
	is_dropoff boolean not null default false
);
alter table public.campus_places enable row level security;
create policy "campus places are public" on public.campus_places for select using (true);

insert into public.campus_places (id, name, lat, lng, is_dropoff) values
	-- Store zones (stores.zone)
	('kfc-main', 'โรงอาหาร KFC (หลัก)', 13.6503, 100.49178, false),
	('female-dorm', 'โรงอาหารหอหญิง', 13.64874, 100.4949, false),
	('male-dorm', 'โรงอาหารหอชาย', 13.6492, 100.49467, false),
	('cb1', 'อาคาร CB1', 13.65115, 100.493, false),
	('green-canteen', 'โรงอาหาร 190 ปี (Green Canteen)', 13.6503, 100.49178, false),
	('dorm', 'โซนหอพักนักศึกษา', 13.64897, 100.49471, false),
	-- Drop-off points: buildings; the buyer picks the floor
	('lx-1', 'อาคาร LX', 13.65163, 100.49389, true),
	('cb2', 'อาคารเรียนรวม CB2', 13.65123, 100.49344, true),
	('cb3', 'อาคารเรียนรวม CB3', 13.64932, 100.49203, true),
	('sit', 'อาคาร SIT', 13.65225, 100.49333, true),
	('eng12', 'ตึกวิศวะ 12 ชั้น', 13.64975, 100.49424, true),
	('lib', 'หอสมุด มจธ. (KMUTT Library)', 13.65282, 100.49362, true),
	('dorm-s5', 'หอพักชาย S5', 13.6492, 100.49467, true),
	('dorm-s6', 'หอพักหญิง S6', 13.64874, 100.4949, true)
on conflict (id) do nothing;

-- Straight-line distance in metres
create or replace function public.distance_m(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language sql immutable as $$
	select 2 * 6371000 * asin(sqrt(
		power(sin(radians(b_lat - a_lat) / 2), 2)
		+ cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2)
	))
$$;

-- The numbers, in one place
create or replace function public.fee_near_m() returns int language sql immutable as $$ select 300 $$;
create or replace function public.fee_cap() returns int language sql immutable as $$ select 25 $$;
create or replace function public.rain_fee() returns int language sql immutable as $$ select 5 $$;
create or replace function public.max_order_items() returns int language sql immutable as $$ select 5 $$;

-- ---------- Rain switch (STAFF or ADMIN) ----------
insert into public.app_settings (key, value) values ('rain_surcharge', 'false') on conflict (key) do nothing;

create or replace function public.rain_surcharge_on() returns boolean
language sql stable security definer set search_path = public as $$
	select coalesce((select value = 'true'::jsonb from app_settings where key = 'rain_surcharge'), false)
$$;

create or replace function public.admin_set_rain_surcharge(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
	perform require_team();
	update app_settings set value = to_jsonb(coalesce(p_on, false)), updated_at = now(),
		updated_by = (select coalesce(nullif(nickname, ''), nullif(full_name, ''), email) from profiles where id = auth.uid())
	where key = 'rain_surcharge';
	perform log_admin(case when p_on then 'RAIN_ON' else 'RAIN_OFF' end, 'setting', 'rain_surcharge', 'ค่าหิ้วช่วงฝนตก +' || rain_fee() || ' บาท');
end $$;

create or replace function public.app_flags() returns jsonb
language sql stable security definer set search_path = public as $$
	select jsonb_build_object(
		'payment_test_mode', payment_test_mode(),
		'payment_test_since', (select updated_at from app_settings where key = 'payment_test_mode' and value = 'true'::jsonb),
		'payment_test_by', (select updated_by from app_settings where key = 'payment_test_mode' and value = 'true'::jsonb),
		'rain_surcharge', rain_surcharge_on(),
		'rain_fee', rain_fee(),
		'rain_since', (select updated_at from app_settings where key = 'rain_surcharge' and value = 'true'::jsonb),
		'rain_by', (select updated_by from app_settings where key = 'rain_surcharge' and value = 'true'::jsonb)
	)
$$;

-- ---------- The quote ----------
-- p_store_id null = ฝากซื้อ. Returns {base, floor_fee, rain, fee, distance_m, near}
create or replace function public.delivery_quote(p_store_id text, p_dropoff_id text, p_floor int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
	v_drop campus_places%rowtype;
	v_from campus_places%rowtype;
	v_distance double precision;
	v_base int;
	v_floor_fee int;
	v_rain int := case when rain_surcharge_on() then rain_fee() else 0 end;
begin
	select * into v_drop from campus_places where id = p_dropoff_id and is_dropoff;
	if v_drop.id is null then raise exception 'BAD_DROPOFF'; end if;
	if p_floor is null or p_floor not between 1 and 20 then raise exception 'BAD_FLOOR'; end if;
	if p_store_id is null then
		v_base := custom_delivery_fee();
	else
		select p.* into v_from from stores s join campus_places p on p.id = s.zone::text where s.id = p_store_id;
		if v_from.id is null then raise exception 'STORE_UNAVAILABLE'; end if;
		v_distance := distance_m(v_from.lat, v_from.lng, v_drop.lat, v_drop.lng);
		v_base := case when v_distance <= fee_near_m() then store_delivery_fee() else custom_delivery_fee() end;
	end if;
	-- 1 ฿ a floor above the first, and base + floors never above the cap
	v_floor_fee := greatest(0, least(p_floor - 1, fee_cap() - v_base));
	return jsonb_build_object(
		'base', v_base, 'floor_fee', v_floor_fee, 'rain', v_rain, 'fee', v_base + v_floor_fee + v_rain,
		'distance_m', round(v_distance), 'near', v_distance <= fee_near_m()
	);
end $$;

alter table public.orders
	add column dropoff_id text,
	add column dropoff_floor int,
	add column fee_rain int not null default 0;

-- The order itself, with the fee handed in (internal)
create or replace function public.place_order_core(
	p_store_id text,
	p_items jsonb,
	p_dropoff text,
	p_note text,
	p_payment public.payment_method,
	p_promo_code text,
	p_fee int
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
	v_uid uuid := auth.uid();
	v_store stores%rowtype;
	v_food int := 0;
	v_qty int := 0;
	v_fee int := p_fee;
	v_details text;
	v_best promotions%rowtype;
	v_partner int := 0;
	v_effective_fee int;
	v_code text := nullif(upper(trim(coalesce(p_promo_code, ''))), '');
	v_code_discount int := 0;
	v_order_id uuid;
	v_lines jsonb;
begin
	if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
	select * into v_store from stores where id = p_store_id;
	if v_store.id is null or not v_store.is_open then raise exception 'STORE_UNAVAILABLE'; end if;
	if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;

	-- Resolve every line against the live menu; prices always come from the database.
	-- A พิเศษ line only resolves when the item is sold in that size.
	select jsonb_agg(jsonb_build_object(
		'id', m.id,
		'special', l.special,
		'name', m.name || case when l.special then ' (พิเศษ)' else '' end,
		'price', case when l.special then m.special_price else m.price end,
		'quantity', l.quantity
	))
	into v_lines
	from (
		select i ->> 'menu_item_id' as menu_item_id,
			coalesce((i ->> 'special')::boolean, false) as special,
			(i ->> 'quantity')::int as quantity
		from jsonb_array_elements(p_items) i
	) l
	join menu_items m on m.id = l.menu_item_id and m.store_id = p_store_id and m.is_available
		and (not l.special or m.special_price is not null);

	if coalesce(jsonb_array_length(v_lines), 0) <> jsonb_array_length(p_items)
		or (select count(distinct (i ->> 'menu_item_id', coalesce((i ->> 'special')::boolean, false))) from jsonb_array_elements(p_items) i) <> jsonb_array_length(p_items) then
		raise exception 'ITEM_UNAVAILABLE';
	end if;
	if exists (select 1 from jsonb_to_recordset(v_lines) as l(quantity int) where l.quantity not between 1 and 50) then
		raise exception 'BAD_QUANTITY';
	end if;

	select sum(l.price * l.quantity), sum(l.quantity), string_agg(l.name || ' ×' || l.quantity, ', ')
	into v_food, v_qty, v_details
	from jsonb_to_recordset(v_lines) as l(id text, name text, price int, quantity int);

	-- Best live promotion for this cart (same rule as pricing.ts bestPromotion)
	select * into v_best from promotions
	where store_id = p_store_id and active and approved and min_qty <= v_qty
		and (ends_at is null or ends_at > now())
	order by discount + case when free_delivery then v_fee else 0 end desc, created_at
	limit 1;
	if v_best.id is not null then
		v_partner := v_best.discount + case when v_best.free_delivery then v_fee else 0 end;
	end if;
	v_effective_fee := case when v_best.free_delivery then 0 else v_fee end;

	if v_code = 'KMUTTFIRST' then
		if exists (select 1 from orders where customer_id = v_uid and status <> 'CANCELLED') then
			raise exception 'PROMO_NOT_ELIGIBLE';
		end if;
		v_code_discount := 15;
	elsif v_code = 'GOOSEFREE' then
		v_code_discount := v_effective_fee;
	elsif v_code is not null then
		raise exception 'PROMO_INVALID';
	end if;

	insert into orders (
		order_code, kind, customer_id, store_id, pickup_name, dropoff_name, item_details,
		food_total, delivery_fee, code_discount, partner_discount, promo_code, promotion_id,
		total_price, payment_method, note
	) values (
		new_order_code(), 'STORE', v_uid, p_store_id, v_store.name, p_dropoff, v_details,
		v_food, v_fee, v_code_discount, v_partner, v_code, v_best.id,
		greatest(0, v_food + v_fee - v_code_discount - v_partner), p_payment, nullif(trim(p_note), '')
	) returning id into v_order_id;

	insert into order_items (order_id, menu_item_id, special, name, price, quantity)
	select v_order_id, l.id, l.special, l.name, l.price, l.quantity
	from jsonb_to_recordset(v_lines) as l(id text, special boolean, name text, price int, quantity int);

	insert into order_secrets (order_id, otp_code)
	values (v_order_id, lpad((floor(random() * 10000))::int::text, 4, '0'));
	insert into chat_messages (order_id, sender_role, body)
	values (v_order_id, 'SYSTEM', 'สร้างออเดอร์แล้ว กำลังหาเพื่อนรับหิ้ว');
	return v_order_id;
end $$;

-- The old entry points keep working inside the database (flat fee), but the app
-- no longer calls them
create or replace function public.place_order(
	p_store_id text,
	p_items jsonb,
	p_dropoff text,
	p_note text,
	p_payment public.payment_method,
	p_promo_code text default null
) returns uuid
language sql security definer set search_path = public as $$
	select place_order_core(p_store_id, p_items, p_dropoff, p_note, p_payment, p_promo_code, store_delivery_fee())
$$;

-- "อาคาร SIT ชั้น 5"
create or replace function public.dropoff_label(p_dropoff_id text, p_floor int) returns text
language sql stable security definer set search_path = public as $$
	select name || ' ชั้น ' || p_floor from campus_places where id = p_dropoff_id
$$;

-- Store order: fee from the quote, at most 5 items, optional round-up tip
create or replace function public.place_order_at(
	p_store_id text,
	p_items jsonb,
	p_dropoff_id text,
	p_floor int,
	p_note text,
	p_payment public.payment_method,
	p_promo_code text default null,
	p_tip int default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
	v_quote jsonb;
	v_qty int;
	v_id uuid;
	v_total int;
	v_tip int := coalesce(p_tip, 0);
begin
	if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
	if jsonb_typeof(p_items) = 'array' then
		select coalesce(sum(case when jsonb_typeof(i -> 'quantity') = 'number' then (i ->> 'quantity')::numeric else 0 end), 0)
		into v_qty from jsonb_array_elements(p_items) i;
		if v_qty > max_order_items() then raise exception 'TOO_MANY_ITEMS'; end if;
	end if;
	v_quote := delivery_quote(p_store_id, p_dropoff_id, p_floor);
	v_id := place_order_core(p_store_id, p_items, dropoff_label(p_dropoff_id, p_floor), p_note, p_payment, p_promo_code, (v_quote ->> 'fee')::int);
	update orders set dropoff_id = p_dropoff_id, dropoff_floor = p_floor, fee_rain = (v_quote ->> 'rain')::int where id = v_id;
	if v_tip <> 0 then
		select total_price into v_total from orders where id = v_id;
		if v_tip <> round_up_tip(v_total) then raise exception 'BAD_TIP'; end if;
		update orders set tip = v_tip, tip_in_total = true, total_price = v_total + v_tip where id = v_id;
	end if;
	return v_id;
end $$;

-- ฝากซื้อ: base 20 + floor + rain
create or replace function public.place_custom_order_at(
	p_pickup text,
	p_items text,
	p_estimated int,
	p_dropoff_id text,
	p_floor int,
	p_note text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
	v_uid uuid := auth.uid();
	v_quote jsonb;
	v_fee int;
	v_order_id uuid;
begin
	if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
	if char_length(trim(p_items)) not between 3 and 300 then raise exception 'BAD_ITEMS'; end if;
	if p_estimated not between 1 and 1000 then raise exception 'BAD_PRICE'; end if;
	v_quote := delivery_quote(null, p_dropoff_id, p_floor);
	v_fee := (v_quote ->> 'fee')::int;

	insert into orders (
		order_code, kind, customer_id, pickup_name, dropoff_name, item_details,
		food_total, delivery_fee, total_price, payment_method, note, dropoff_id, dropoff_floor, fee_rain
	) values (
		new_order_code(), 'CUSTOM', v_uid, p_pickup, dropoff_label(p_dropoff_id, p_floor), trim(p_items),
		p_estimated, v_fee, p_estimated + v_fee, 'CASH', nullif(trim(p_note), ''), p_dropoff_id, p_floor, (v_quote ->> 'rain')::int
	) returning id into v_order_id;

	insert into order_secrets (order_id, otp_code)
	values (v_order_id, lpad((floor(random() * 10000))::int::text, 4, '0'));
	insert into chat_messages (order_id, sender_role, body)
	values (v_order_id, 'SYSTEM', 'สร้างออเดอร์แล้ว กำลังหาเพื่อนรับหิ้ว');
	return v_order_id;
end $$;

revoke execute on function
	public.place_order_core(text, jsonb, text, text, public.payment_method, text, int),
	public.place_order(text, jsonb, text, text, public.payment_method, text),
	public.place_order_tipped(text, jsonb, text, text, public.payment_method, text, int),
	public.place_custom_order(text, text, int, text, text),
	public.rain_surcharge_on()
from anon, authenticated, public;
grant execute on function public.delivery_quote(text, text, int), public.app_flags(), public.dropoff_label(text, int) to anon, authenticated;
grant execute on function
	public.place_order_at(text, jsonb, text, int, text, public.payment_method, text, int),
	public.place_custom_order_at(text, text, int, text, int, text),
	public.admin_set_rain_surcharge(boolean)
to authenticated;
revoke execute on function
	public.place_order_at(text, jsonb, text, int, text, public.payment_method, text, int),
	public.place_custom_order_at(text, text, int, text, int, text),
	public.admin_set_rain_surcharge(boolean)
from anon, public;
