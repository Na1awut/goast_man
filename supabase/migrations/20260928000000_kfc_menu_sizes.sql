-- ============================================================
-- Real stores of โรงอาหาร KFC (หลัก) + ธรรมดา / พิเศษ menu sizes
--
-- Adds the KFC (main) canteen as a store zone, and a second size for menu
-- items: many stalls sell each dish as ธรรมดา or พิเศษ (larger, dearer).
-- The price of either size still comes only from the database.
--
-- Run this before seed.sql: a new enum value cannot be used in the same
-- transaction that adds it.
-- ============================================================

alter type public.store_zone add value if not exists 'kfc-main';

alter table public.menu_items
	add column special_price int check (special_price is null or special_price > price);

-- One line per menu item per size
alter table public.order_items add column special boolean not null default false;
alter table public.order_items drop constraint order_items_pkey;
alter table public.order_items add primary key (order_id, menu_item_id, special);

-- p_items: [{ "menu_item_id": "kfc-05-4", "quantity": 1, "special": true }]
create or replace function public.place_order(
	p_store_id text,
	p_items jsonb,
	p_dropoff text,
	p_note text,
	p_payment public.payment_method,
	p_promo_code text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
	v_uid uuid := auth.uid();
	v_store stores%rowtype;
	v_food int := 0;
	v_qty int := 0;
	v_fee int := store_delivery_fee();
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

-- The buyer's order lines now say which size was bought
create or replace function public.my_orders(p_order_id uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
	select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb)
	from (
		select o.*,
			case when o.status in ('ACCEPTED', 'DELIVERING') then s.otp_code end as otp_code,
			(
				select jsonb_agg(jsonb_build_object('menu_item_id', i.menu_item_id, 'special', i.special, 'name', i.name, 'price', i.price, 'quantity', i.quantity))
				from order_items i where i.order_id = o.id
			) as items,
			case when o.rider_id is not null then (
				select jsonb_build_object(
					'id', p.id, 'name', p.nickname, 'full_name', p.full_name,
					'faculty', trim(both ' ·' from concat_ws(' · ', nullif(p.faculty, ''), nullif(level_label(p.study_level), ''))),
					'phone', coalesce(p.phone, ''),
					'rating', coalesce((select round(avg(rating)::numeric, 2) from orders r where r.rider_id = p.id and r.rating is not null), 5),
					'jobs', (select count(*) from orders r where r.rider_id = p.id and r.status = 'COMPLETED')
				) from profiles p where p.id = o.rider_id
			) end as rider
		from orders o
		left join order_secrets s on s.order_id = o.id
		where o.customer_id = auth.uid() and (p_order_id is null or o.id = p_order_id)
	) x
$$;
