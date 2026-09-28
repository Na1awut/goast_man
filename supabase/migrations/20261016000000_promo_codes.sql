-- ============================================================
-- App discount codes, fully replacing the hardcoded KMUTTFIRST / GOOSEFREE
--
-- An ADMIN creates a code from the console (หน้า "โค้ดส่วนลด"): a fixed
-- baht amount off, or free delivery; when it starts working (immediately, or
-- a later date/time — release a code ahead of an event); and how many times
-- it can be redeemed in total. STAFF can see the list; only ADMIN creates or
-- switches a code on/off (money given away, same bar as the QR test mode).
--
-- These are the app's money (unlike a store's own DEAL, which is the store's).
-- A buyer checks a code at checkout (check_promo_code, no side effect) and it
-- is validated again, for real, when the order is placed (place_order_core),
-- which is the only place a redemption is counted — by counting orders that
-- carry the code, the same way a store promotion's "uses" is counted.
-- ============================================================

create type public.promo_code_kind as enum ('AMOUNT', 'FREE_DELIVERY');

create table public.promo_codes (
	code text primary key check (code ~ '^[A-Z0-9]{3,20}$'),
	kind public.promo_code_kind not null,
	-- Baht off for AMOUNT; always null for FREE_DELIVERY (waives the whole fee)
	amount int check (amount is null or amount between 1 and 500),
	-- When the code starts working; created "now" by default, or scheduled ahead
	starts_at timestamptz not null default now(),
	max_uses int not null check (max_uses between 1 and 100000),
	active boolean not null default true,
	created_at timestamptz not null default now(),
	created_by text not null default '',
	constraint promo_codes_amount_matches_kind check (
		(kind = 'AMOUNT' and amount is not null) or (kind = 'FREE_DELIVERY' and amount is null)
	)
);
-- No direct access for anyone: read through check_promo_code / admin_promo_codes,
-- write through the admin_* functions below (all security definer)
alter table public.promo_codes enable row level security;

-- ---------- The order itself picks up a code by this same rule ----------

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

	insert into order_items (order_id, menu_item_id, special, name, price, quantity)
	select v_order_id, l.id, l.special, l.name, l.price, l.quantity
	from jsonb_to_recordset(v_lines) as l(id text, special boolean, name text, price int, quantity int);

	insert into order_secrets (order_id, otp_code)
	values (v_order_id, lpad((floor(random() * 10000))::int::text, 4, '0'));
	insert into chat_messages (order_id, sender_role, body)
	values (v_order_id, 'SYSTEM', 'สร้างออเดอร์แล้ว กำลังหาเพื่อนรับหิ้ว');
	return v_order_id;
end $$;

-- ---------- Buyer: check a code before placing the order (no side effect) ----------

create or replace function public.check_promo_code(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
	v_code text := nullif(upper(trim(coalesce(p_code, ''))), '');
	v_promo promo_codes%rowtype;
begin
	if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
	if v_code is null then raise exception 'PROMO_INVALID'; end if;
	select * into v_promo from promo_codes where code = v_code;
	if v_promo.code is null or not v_promo.active then raise exception 'PROMO_INVALID'; end if;
	if v_promo.starts_at > now() then raise exception 'PROMO_NOT_STARTED'; end if;
	if (select count(*) from orders where promo_code = v_code and status <> 'CANCELLED') >= v_promo.max_uses then
		raise exception 'PROMO_USES_UP';
	end if;
	return jsonb_build_object('code', v_promo.code, 'kind', v_promo.kind, 'amount', v_promo.amount);
end $$;

-- ---------- The team: create and switch codes ----------

create or replace function public.admin_create_promo_code(
	p_code text, p_kind text, p_amount int, p_starts_at timestamptz, p_max_uses int
) returns text
language plpgsql security definer set search_path = public as $$
declare
	v_code text := nullif(upper(trim(coalesce(p_code, ''))), '');
	v_kind public.promo_code_kind;
	v_by text;
begin
	perform require_team(true);
	if v_code is null or v_code !~ '^[A-Z0-9]{3,20}$' then raise exception 'BAD_CODE'; end if;
	begin
		v_kind := p_kind::public.promo_code_kind;
	exception when others then
		raise exception 'BAD_KIND';
	end;
	if v_kind = 'AMOUNT' and (p_amount is null or p_amount not between 1 and 500) then raise exception 'BAD_AMOUNT'; end if;
	if v_kind = 'FREE_DELIVERY' and p_amount is not null then raise exception 'BAD_AMOUNT'; end if;
	if p_max_uses is null or p_max_uses not between 1 and 100000 then raise exception 'BAD_MAX_USES'; end if;
	if exists (select 1 from promo_codes where code = v_code) then raise exception 'CODE_TAKEN'; end if;
	select coalesce(nullif(nickname, ''), nullif(full_name, ''), email) into v_by from profiles where id = auth.uid();
	insert into promo_codes (code, kind, amount, starts_at, max_uses, created_by)
	values (v_code, v_kind, p_amount, coalesce(p_starts_at, now()), p_max_uses, coalesce(v_by, ''));
	perform log_admin('PROMO_CODE_CREATED', 'promo_code', v_code, v_code,
		jsonb_build_object('kind', v_kind, 'amount', p_amount, 'starts_at', coalesce(p_starts_at, now()), 'max_uses', p_max_uses));
	return v_code;
end $$;

create or replace function public.admin_set_promo_code_active(p_code text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_code text := upper(trim(coalesce(p_code, '')));
begin
	perform require_team(true);
	update promo_codes set active = coalesce(p_active, false) where code = v_code;
	if not found then raise exception 'PROMO_NOT_FOUND'; end if;
	perform log_admin(case when p_active then 'PROMO_CODE_ON' else 'PROMO_CODE_OFF' end, 'promo_code', v_code, v_code);
end $$;

-- The console's list: every code, how many times it has been used, who made it
create or replace function public.admin_promo_codes() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(jsonb_build_object(
			'code', pc.code, 'kind', pc.kind, 'amount', pc.amount, 'starts_at', pc.starts_at,
			'max_uses', pc.max_uses, 'active', pc.active, 'created_at', pc.created_at, 'created_by', pc.created_by,
			'uses', (select count(*) from orders o where o.promo_code = pc.code and o.status <> 'CANCELLED')
		) order by pc.created_at desc), '[]'::jsonb)
		from promo_codes pc
	);
end $$;

grant execute on function public.check_promo_code(text) to authenticated;
revoke execute on function public.check_promo_code(text) from anon, public;
grant execute on function
	public.admin_create_promo_code(text, text, int, timestamptz, int),
	public.admin_set_promo_code_active(text, boolean),
	public.admin_promo_codes()
to authenticated;
revoke execute on function
	public.admin_create_promo_code(text, text, int, timestamptz, int),
	public.admin_set_promo_code_active(text, boolean),
	public.admin_promo_codes()
from anon, public;
