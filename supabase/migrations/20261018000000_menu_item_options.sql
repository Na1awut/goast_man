-- ============================================================
-- Menu Item Options & Toppings Support
-- Allows stalls to configure toppings (e.g. egg +10฿), spiciness,
-- sweetness, meat choices, etc.
-- ============================================================

-- 1. Schema updates
alter table public.menu_items
	add column if not exists options jsonb not null default '[]'::jsonb;

alter table public.order_items
	add column if not exists selected_options jsonb not null default '[]'::jsonb;

-- 2. Menu Item Saving (with options)
-- Shared implementation used by partners and team
create or replace function public.store_save_menu_item(
	p_store text, p_by text,
	p_id text, p_name text, p_category text, p_price int, p_special_price int,
	p_description text, p_image_url text, p_available boolean,
	p_options jsonb default '[]'::jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
	v_name text := trim(coalesce(p_name, ''));
	v_category text := trim(coalesce(p_category, ''));
	v_description text := trim(coalesce(p_description, ''));
	v_image text := trim(coalesce(p_image_url, ''));
	v_old menu_items%rowtype;
	v_id text := nullif(trim(coalesce(p_id, '')), '');
	v_store_name text;
	v_opts jsonb := coalesce(p_options, '[]'::jsonb);
begin
	if char_length(v_name) not between 1 and 80 then raise exception 'BAD_ITEM_NAME'; end if;
	if char_length(v_category) not between 1 and 40 then raise exception 'BAD_CATEGORY'; end if;
	if p_price is null or p_price not between 1 and 2000 then raise exception 'BAD_PRICE'; end if;
	if p_special_price is not null and (p_special_price <= p_price or p_special_price > 2000) then raise exception 'BAD_SPECIAL_PRICE'; end if;
	if char_length(v_description) > 200 then raise exception 'NOTE_TOO_LONG'; end if;
	if jsonb_typeof(v_opts) <> 'array' then raise exception 'BAD_OPTIONS'; end if;

	if v_id is not null then
		select * into v_old from menu_items where id = v_id and store_id = p_store and not archived;
		if v_old.id is null then raise exception 'ITEM_NOT_FOUND'; end if;
	end if;

	-- A new photo must be the store's own upload or base64/external; an unchanged one may stay
	if v_image <> '' and v_image is distinct from v_old.image_url and not (
		is_store_image(v_image, p_store) or v_image like 'data:image/%' or v_image like 'https://%'
	) then
		raise exception 'BAD_IMAGE';
	end if;

	if v_id is null then
		v_id := p_store || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
		insert into menu_items (id, store_id, name, price, special_price, description, image_url, category, is_available, sort, options)
		values (v_id, p_store, v_name, p_price, p_special_price, v_description, v_image, v_category, coalesce(p_available, true),
			(select coalesce(max(sort), 0) + 1 from menu_items where store_id = p_store), v_opts);
	else
		update menu_items set name = v_name, price = p_price, special_price = p_special_price, description = v_description,
			image_url = v_image, category = v_category, is_available = coalesce(p_available, is_available), options = v_opts
		where id = v_id;
	end if;

	select name into v_store_name from stores where id = p_store;
	perform log_admin(case when v_old.id is null then 'ITEM_ADDED' else 'ITEM_EDITED' end, 'store', p_store, v_store_name,
		jsonb_build_object('item_id', v_id, 'item', v_name, 'price', p_price, 'was', v_old.price, 'by', p_by));
	return v_id;
end $$;

-- Team console: save any store's menu item
drop function if exists public.admin_save_menu_item(text, text, text, text, int, int, text, text, boolean);
create or replace function public.admin_save_menu_item(
	p_store_id text, p_id text, p_name text, p_category text, p_price int, p_special_price int,
	p_description text, p_image_url text, p_available boolean default true,
	p_options jsonb default '[]'::jsonb
) returns text
language plpgsql security definer set search_path = public as $$
begin
	perform require_team();
	if not exists (select 1 from stores where id = p_store_id) then raise exception 'STORE_NOT_FOUND'; end if;
	return store_save_menu_item(p_store_id, 'team', p_id, p_name, p_category, p_price, p_special_price, p_description, p_image_url, p_available, p_options);
end $$;

grant execute on function public.admin_save_menu_item(text, text, text, text, int, int, text, text, boolean, jsonb) to authenticated;

-- Partner portal: save own store's menu item
drop function if exists public.partner_save_menu_item(text, text, text, int, int, text, text, boolean);
create or replace function public.partner_save_menu_item(
	p_id text, p_name text, p_category text, p_price int, p_special_price int,
	p_description text, p_image_url text, p_available boolean default true,
	p_options jsonb default '[]'::jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare v_store text := partner_store();
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	return store_save_menu_item(v_store, 'partner', p_id, p_name, p_category, p_price, p_special_price, p_description, p_image_url, p_available, p_options);
end $$;

grant execute on function public.partner_save_menu_item(text, text, text, int, int, text, text, boolean, jsonb) to authenticated;

-- 3. Update place_order_core to calculate price with selected options
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

	-- Resolve every line against live menu; prices include selected options
	select jsonb_agg(jsonb_build_object(
		'id', m.id,
		'special', l.special,
		'selected_options', l.selected_options,
		'name', m.name || case when l.special then ' (พิเศษ)' else '' end || case when l.opt_summary <> '' then ' (+' || l.opt_summary || ')' else '' end,
		'price', (case when l.special then m.special_price else m.price end) + l.opt_extra,
		'quantity', l.quantity
	))
	into v_lines
	from (
		select i ->> 'menu_item_id' as menu_item_id,
			coalesce((i ->> 'special')::boolean, false) as special,
			(i ->> 'quantity')::int as quantity,
			coalesce(i -> 'selected_options', '[]'::jsonb) as selected_options,
			coalesce((
				select sum(case when (opt ->> 'price')::int > 0 then (opt ->> 'price')::int else 0 end)::int
				from jsonb_array_elements(coalesce(i -> 'selected_options', '[]'::jsonb)) opt
			), 0) as opt_extra,
			coalesce((
				select string_agg(opt ->> 'name', ', ')
				from jsonb_array_elements(coalesce(i -> 'selected_options', '[]'::jsonb)) opt
			), '') as opt_summary
		from jsonb_array_elements(p_items) i
	) l
	join menu_items m on m.id = l.menu_item_id and m.store_id = p_store_id and m.is_available
		and (not l.special or m.special_price is not null);

	if coalesce(jsonb_array_length(v_lines), 0) <> jsonb_array_length(p_items) then
		raise exception 'ITEM_UNAVAILABLE';
	end if;
	if exists (select 1 from jsonb_to_recordset(v_lines) as l(quantity int) where l.quantity not between 1 and 50) then
		raise exception 'BAD_QUANTITY';
	end if;

	select sum(l.price * l.quantity), sum(l.quantity), string_agg(l.name || ' ×' || l.quantity, ', ')
	into v_food, v_qty, v_details
	from jsonb_to_recordset(v_lines) as l(id text, name text, price int, quantity int);

	-- Best live promotion for this cart
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

	insert into order_items (order_id, menu_item_id, special, name, price, quantity, selected_options)
	select v_order_id, l.id, l.special, l.name, l.price, l.quantity, coalesce(l.selected_options, '[]'::jsonb)
	from jsonb_to_recordset(v_lines) as l(id text, special boolean, name text, price int, quantity int, selected_options jsonb);

	insert into order_secrets (order_id, otp_code)
	values (v_order_id, lpad((floor(random() * 10000))::int::text, 4, '0'));
	insert into chat_messages (order_id, sender_role, body)
	values (v_order_id, 'SYSTEM', 'สร้างออเดอร์แล้ว กำลังหาเพื่อนรับหิ้ว');
	return v_order_id;
end $$;

-- 4. Update my_orders to return selected_options
create or replace function public.my_orders(p_order_id uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
	select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb)
	from (
		select o.*,
			case when o.status in ('ACCEPTED', 'DELIVERING') then s.otp_code end as otp_code,
			(
				select jsonb_agg(jsonb_build_object(
					'menu_item_id', i.menu_item_id,
					'special', i.special,
					'name', i.name,
					'price', i.price,
					'quantity', i.quantity,
					'selected_options', coalesce(i.selected_options, '[]'::jsonb)
				))
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

-- 5. Update rider_board to return selected_options
create or replace function public.rider_board() returns jsonb
language sql stable security definer set search_path = public as $$
	select case when not is_rider() then null else jsonb_build_object(
		'capacity', rider_capacity(),
		'open', (
			select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at), '[]'::jsonb)
			from (
				select o.id, o.order_code, o.kind, o.store_id, o.pickup_name, o.dropoff_name, o.item_details,
					o.food_total, o.delivery_fee, o.total_price, o.payment_method, o.status, o.note, o.created_at,
					(select jsonb_agg(jsonb_build_object('name', i.name, 'price', i.price, 'quantity', i.quantity, 'selected_options', coalesce(i.selected_options, '[]'::jsonb)))
						from order_items i where i.order_id = o.id) as items
				from orders o
				where o.status = 'PENDING' and o.customer_id <> auth.uid()
					and (o.payment_method = 'CASH' or o.paid_at is not null)
			) j
		),
		'mine', (
			select coalesce(jsonb_agg(to_jsonb(j) order by j.accepted_at), '[]'::jsonb)
			from (
				select o.id, o.order_code, o.kind, o.store_id, o.pickup_name, o.dropoff_name, o.item_details,
					o.food_total, o.delivery_fee, o.total_price, o.payment_method, o.status, o.note, o.created_at,
					o.accepted_at, o.delivering_at,
					(select jsonb_agg(jsonb_build_object('name', i.name, 'price', i.price, 'quantity', i.quantity, 'selected_options', coalesce(i.selected_options, '[]'::jsonb)))
						from order_items i where i.order_id = o.id) as items,
					jsonb_build_object('nickname', p.nickname, 'phone', coalesce(p.phone, '')) as customer
				from orders o join profiles p on p.id = o.customer_id
				where o.rider_id = auth.uid() and o.status in ('ACCEPTED', 'DELIVERING')
			) j
		)
	) end
$$;
