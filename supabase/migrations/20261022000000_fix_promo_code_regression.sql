-- ============================================================
-- Fix Promo Code Regression in place_order_core
-- Re-applies the dynamic promo_codes lookup from 20261016000000_promo_codes.sql
-- while keeping selected_options support from 20261018000000_menu_item_options.sql
-- ============================================================

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
	v_promo promo_codes%rowtype;
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

	-- An app discount code: 1 ฿ off (or free delivery), created and scheduled from the console
	if v_code is not null then
		select * into v_promo from promo_codes where code = v_code for update;
		if v_promo.code is null or not v_promo.active then raise exception 'PROMO_INVALID'; end if;
		if v_promo.starts_at > now() then raise exception 'PROMO_NOT_STARTED'; end if;
		if (select count(*) from orders where promo_code = v_code and status <> 'CANCELLED') >= v_promo.max_uses then
			raise exception 'PROMO_USES_UP';
		end if;
		v_code_discount := case when v_promo.kind = 'FREE_DELIVERY' then v_effective_fee else v_promo.amount end;
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
