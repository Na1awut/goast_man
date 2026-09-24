-- ============================================================
-- Goose Man (ห่านบางมด) — Supabase schema
-- Replaces the Go/Fiber backend: Auth, data, RLS, realtime and
-- server-side business rules (pricing, order state machine, OTP).
--
-- Rules of thumb used throughout:
--   * Clients never write orders directly. Every state change goes
--     through a SECURITY DEFINER function that re-checks who is calling.
--   * Money is recomputed on the server from database prices; the
--     client total is only a preview.
--   * The OTP lives in its own table that no client can select.
-- ============================================================

-- gen_random_uuid() is built into Postgres 13+, no extension needed

-- ---------- Enums ----------
create type public.user_role as enum ('STUDENT', 'PARTNER', 'ADMIN');
create type public.order_status as enum ('PENDING', 'ACCEPTED', 'DELIVERING', 'COMPLETED', 'CANCELLED');
create type public.order_kind as enum ('STORE', 'CUSTOM');
create type public.payment_method as enum ('PROMPTPAY', 'CASH');
create type public.promo_kind as enum ('DEAL', 'CO_PROMO');
create type public.store_zone as enum ('canteen-male', 'green-canteen', 'dorm');

-- Pricing constants (mirrors frontend/src/lib/pricing.ts)
create or replace function public.store_delivery_fee() returns int language sql immutable as $$ select 15 $$;
create or replace function public.custom_delivery_fee() returns int language sql immutable as $$ select 20 $$;

-- ============================================================
-- Catalogue
-- ============================================================
create table public.stores (
	id text primary key,
	zone public.store_zone not null,
	name text not null,
	category text not null,
	description text not null default '',
	image_url text not null default '',
	-- Partner storefront
	is_partner boolean not null default false,
	owner_id uuid references auth.users on delete set null,
	banner_url text,
	tagline text check (tagline is null or char_length(tagline) <= 80),
	fast_lane_minutes int check (fast_lane_minutes is null or fast_lane_minutes between 1 and 60),
	-- Operations
	is_open boolean not null default true,
	rating numeric(2, 1) not null default 0,
	reviews_count text not null default '0',
	queue_minutes int not null default 10 check (queue_minutes between 0 and 120),
	lock text not null default '',
	created_at timestamptz not null default now()
);

create table public.menu_items (
	id text primary key,
	store_id text not null references public.stores on delete cascade,
	name text not null,
	price int not null check (price >= 0),
	original_price int check (original_price is null or original_price > price),
	description text not null default '',
	image_url text not null default '',
	category text not null default '',
	is_available boolean not null default true,
	is_popular boolean not null default false,
	sort int not null default 0
);
create index menu_items_store_idx on public.menu_items (store_id, sort);

-- DEAL      = the store's own promotion, live as soon as it is saved.
-- CO_PROMO  = a joint promotion with Goose Man; shown only after an admin approves it.
create table public.promotions (
	id uuid primary key default gen_random_uuid(),
	store_id text not null references public.stores on delete cascade,
	kind public.promo_kind not null,
	title text not null check (char_length(title) between 3 and 80),
	description text not null default '' check (char_length(description) <= 200),
	min_qty int not null default 1 check (min_qty between 1 and 20),
	discount int not null default 0 check (discount between 0 and 200),
	free_delivery boolean not null default false,
	banner_url text,
	ends_at timestamptz,
	active boolean not null default true,
	approved boolean not null default false,
	created_at timestamptz not null default now(),
	constraint promotions_has_benefit check (discount > 0 or free_delivery)
);
create index promotions_store_idx on public.promotions (store_id) where active;

-- ============================================================
-- People
-- ============================================================
create table public.profiles (
	id uuid primary key references auth.users on delete cascade,
	email text not null unique,
	full_name text not null default '',
	nickname text not null default '',
	student_id text,
	faculty text,
	phone text,
	promptpay_no text,
	role public.user_role not null default 'STUDENT',
	partner_store_id text references public.stores on delete set null,
	created_at timestamptz not null default now()
);

-- Shop owners are not students, so they cannot pass the @kmutt.ac.th rule.
-- An admin invites them by email; the invite binds the account to its store.
create table public.partner_invites (
	email text primary key check (email = lower(email)),
	store_id text not null references public.stores on delete cascade,
	created_at timestamptz not null default now()
);

create or replace function public.is_kmutt_email(p_email text) returns boolean
language sql immutable as $$
	select split_part(lower(p_email), '@', 2) in ('kmutt.ac.th', 'mail.kmutt.ac.th')
$$;

create or replace function public.current_role_is(p_role public.user_role) returns boolean
language sql stable security definer set search_path = public as $$
	select exists (select 1 from profiles where id = auth.uid() and role = p_role)
$$;

-- Runs inside the sign-up transaction: raising here rejects the account.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
	v_email text := lower(new.email);
	v_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '');
	v_invite partner_invites%rowtype;
begin
	select * into v_invite from partner_invites where email = v_email;

	if v_invite.email is not null then
		insert into profiles (id, email, full_name, nickname, role, partner_store_id)
		values (new.id, v_email, v_name, split_part(v_name, ' ', 1), 'PARTNER', v_invite.store_id);
		update stores set owner_id = new.id, is_partner = true where id = v_invite.store_id;
		delete from partner_invites where email = v_email;
	elsif public.is_kmutt_email(v_email) then
		insert into profiles (id, email, full_name, nickname, role)
		values (new.id, v_email, v_name, split_part(v_name, ' ', 1), 'STUDENT');
	else
		raise exception 'KMUTT_ONLY: sign-up is limited to @kmutt.ac.th accounts and invited partner stores';
	end if;
	return new;
end $$;

create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function public.handle_new_user();

-- ============================================================
-- Orders
-- ============================================================
create table public.orders (
	id uuid primary key default gen_random_uuid(),
	order_code text not null unique,
	kind public.order_kind not null,
	customer_id uuid not null references auth.users on delete cascade,
	rider_id uuid references auth.users on delete set null,
	store_id text references public.stores on delete set null,
	pickup_name text not null,
	dropoff_name text not null,
	item_details text not null,
	food_total int not null check (food_total >= 0),
	delivery_fee int not null check (delivery_fee >= 0),
	code_discount int not null default 0 check (code_discount >= 0),
	partner_discount int not null default 0 check (partner_discount >= 0),
	promo_code text,
	promotion_id uuid references public.promotions on delete set null,
	total_price int not null check (total_price >= 0),
	payment_method public.payment_method not null,
	status public.order_status not null default 'PENDING',
	note text check (note is null or char_length(note) <= 120),
	created_at timestamptz not null default now(),
	accepted_at timestamptz,
	delivering_at timestamptz,
	completed_at timestamptz,
	rating int check (rating between 1 and 5),
	feedback_tags text[] not null default '{}',
	tip int not null default 0 check (tip between 0 and 100)
);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_rider_idx on public.orders (rider_id, created_at desc);
create index orders_pending_idx on public.orders (created_at) where status = 'PENDING';

create table public.order_items (
	order_id uuid not null references public.orders on delete cascade,
	menu_item_id text not null references public.menu_items on delete restrict,
	name text not null,
	price int not null,
	quantity int not null check (quantity between 1 and 50),
	primary key (order_id, menu_item_id)
);

-- Never exposed to clients through RLS: only my_orders() hands the OTP to the customer.
create table public.order_secrets (
	order_id uuid primary key references public.orders on delete cascade,
	otp_code text not null,
	failed_attempts int not null default 0
);

create table public.chat_messages (
	id uuid primary key default gen_random_uuid(),
	order_id uuid not null references public.orders on delete cascade,
	sender_id uuid references auth.users on delete set null,
	sender_role text not null check (sender_role in ('CUSTOMER', 'RIDER', 'SYSTEM')),
	body text not null default '' check (char_length(body) <= 300),
	image_path text,
	created_at timestamptz not null default now(),
	constraint chat_has_content check (body <> '' or image_path is not null)
);
create index chat_messages_order_idx on public.chat_messages (order_id, created_at);

create or replace function public.is_order_participant(p_order_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
	select exists (
		select 1 from orders where id = p_order_id and auth.uid() in (customer_id, rider_id)
	)
$$;

-- System lines in the chat whenever the order moves
create or replace function public.log_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_text text;
begin
	if new.status is distinct from old.status then
		v_text := case new.status
			when 'ACCEPTED' then 'เพื่อนรับงานหิ้วแล้ว'
			when 'DELIVERING' then 'คนหิ้วได้รับของครบแล้ว กำลังเดินมาส่ง'
			when 'COMPLETED' then 'ยืนยัน OTP สำเร็จ ส่งมอบเรียบร้อย'
			when 'CANCELLED' then 'ออเดอร์ถูกยกเลิก'
			else null end;
		if v_text is not null then
			insert into chat_messages (order_id, sender_role, body) values (new.id, 'SYSTEM', v_text);
		end if;
	end if;
	return new;
end $$;

create trigger orders_status_log after update of status on public.orders
	for each row execute function public.log_order_status();

-- ============================================================
-- Promotion approval guard
-- ============================================================
create or replace function public.guard_promotion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	-- No signed-in user = SQL editor, seed or service role: trust as admin
	if auth.uid() is null or public.current_role_is('ADMIN') then
		return new;
	end if;
	if new.kind = 'DEAL' then
		new.approved := true;
	elsif tg_op = 'INSERT' then
		new.approved := false;
	elsif (new.title, new.description, new.min_qty, new.discount, new.free_delivery, new.banner_url, new.ends_at, new.kind)
		is distinct from
		(old.title, old.description, old.min_qty, old.discount, old.free_delivery, old.banner_url, old.ends_at, old.kind) then
		-- Editing the terms of a joint promotion sends it back for review
		new.approved := false;
	else
		new.approved := old.approved;
	end if;
	return new;
end $$;

create trigger promotions_guard before insert or update on public.promotions
	for each row execute function public.guard_promotion();

-- ============================================================
-- Business functions (the only way clients change orders)
-- ============================================================
create or replace function public.new_order_code() returns text
language plpgsql volatile set search_path = public as $$
declare v_code text;
begin
	loop
		v_code := '#KM-' || lpad((floor(random() * 10000))::int::text, 4, '0');
		exit when not exists (select 1 from orders where order_code = v_code);
	end loop;
	return v_code;
end $$;

create or replace function public.place_order(
	p_store_id text,
	p_items jsonb,            -- [{ "menu_item_id": "pm1", "quantity": 2 }]
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

	-- Resolve every line against the live menu; prices always come from the database
	select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'price', m.price, 'quantity', (i ->> 'quantity')::int))
	into v_lines
	from jsonb_array_elements(p_items) i
	join menu_items m on m.id = i ->> 'menu_item_id' and m.store_id = p_store_id and m.is_available;

	if coalesce(jsonb_array_length(v_lines), 0) <> jsonb_array_length(p_items)
		or (select count(distinct i ->> 'menu_item_id') from jsonb_array_elements(p_items) i) <> jsonb_array_length(p_items) then
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

	insert into order_items (order_id, menu_item_id, name, price, quantity)
	select v_order_id, l.id, l.name, l.price, l.quantity
	from jsonb_to_recordset(v_lines) as l(id text, name text, price int, quantity int);

	insert into order_secrets (order_id, otp_code)
	values (v_order_id, lpad((floor(random() * 10000))::int::text, 4, '0'));
	insert into chat_messages (order_id, sender_role, body)
	values (v_order_id, 'SYSTEM', 'สร้างออเดอร์แล้ว กำลังหาเพื่อนรับหิ้ว');
	return v_order_id;
end $$;

create or replace function public.place_custom_order(
	p_pickup text,
	p_items text,
	p_estimated int,
	p_dropoff text,
	p_note text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
	v_uid uuid := auth.uid();
	v_fee int := custom_delivery_fee();
	v_order_id uuid;
begin
	if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
	if char_length(trim(p_items)) not between 3 and 300 then raise exception 'BAD_ITEMS'; end if;
	if p_estimated not between 1 and 1000 then raise exception 'BAD_PRICE'; end if;

	insert into orders (
		order_code, kind, customer_id, pickup_name, dropoff_name, item_details,
		food_total, delivery_fee, total_price, payment_method, note
	) values (
		new_order_code(), 'CUSTOM', v_uid, p_pickup, p_dropoff, trim(p_items),
		p_estimated, v_fee, p_estimated + v_fee, 'CASH', nullif(trim(p_note), '')
	) returning id into v_order_id;

	insert into order_secrets (order_id, otp_code)
	values (v_order_id, lpad((floor(random() * 10000))::int::text, 4, '0'));
	insert into chat_messages (order_id, sender_role, body)
	values (v_order_id, 'SYSTEM', 'สร้างออเดอร์แล้ว กำลังหาเพื่อนรับหิ้ว');
	return v_order_id;
end $$;

create or replace function public.cancel_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
	update orders set status = 'CANCELLED'
	where id = p_order_id and customer_id = auth.uid() and status = 'PENDING';
	if not found then raise exception 'CANNOT_CANCEL'; end if;
end $$;

create or replace function public.rate_order(p_order_id uuid, p_rating int, p_tags text[], p_tip int)
returns void language plpgsql security definer set search_path = public as $$
begin
	update orders
	set rating = case when p_rating between 1 and 5 then p_rating else null end,
		feedback_tags = coalesce(p_tags, '{}'),
		tip = greatest(0, least(coalesce(p_tip, 0), 100))
	where id = p_order_id and customer_id = auth.uid() and status = 'COMPLETED';
	if not found then raise exception 'CANNOT_RATE'; end if;
end $$;

-- Rider side (used by the rider app; any student may run errands)
create or replace function public.accept_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
	if not current_role_is('STUDENT') then raise exception 'RIDER_ONLY'; end if;
	-- Single conditional UPDATE: two riders tapping at once cannot both win
	update orders set status = 'ACCEPTED', rider_id = auth.uid(), accepted_at = now()
	where id = p_order_id and status = 'PENDING' and customer_id <> auth.uid();
	if not found then raise exception 'ALREADY_TAKEN'; end if;
end $$;

create or replace function public.mark_delivering(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
	update orders set status = 'DELIVERING', delivering_at = now()
	where id = p_order_id and rider_id = auth.uid() and status = 'ACCEPTED';
	if not found then raise exception 'BAD_STATE'; end if;
end $$;

create or replace function public.confirm_delivery(p_order_id uuid, p_otp text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_secret order_secrets%rowtype;
begin
	if not exists (select 1 from orders where id = p_order_id and rider_id = auth.uid() and status = 'DELIVERING') then
		raise exception 'BAD_STATE';
	end if;
	select * into v_secret from order_secrets where order_id = p_order_id for update;
	if v_secret.failed_attempts >= 5 then raise exception 'OTP_LOCKED'; end if;
	if v_secret.otp_code <> p_otp then
		update order_secrets set failed_attempts = failed_attempts + 1 where order_id = p_order_id;
		return false;
	end if;
	update orders set status = 'COMPLETED', completed_at = now() where id = p_order_id;
	return true;
end $$;

-- Everything the buyer app needs about its orders, in one round trip.
-- The OTP is included only for the customer, and only while it is still needed.
create or replace function public.my_orders(p_order_id uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
	select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb)
	from (
		select o.*,
			case when o.status in ('ACCEPTED', 'DELIVERING') then s.otp_code end as otp_code,
			(
				select jsonb_agg(jsonb_build_object('menu_item_id', i.menu_item_id, 'name', i.name, 'price', i.price, 'quantity', i.quantity))
				from order_items i where i.order_id = o.id
			) as items,
			case when o.rider_id is not null then (
				select jsonb_build_object(
					'id', p.id, 'name', p.nickname, 'full_name', p.full_name, 'faculty', coalesce(p.faculty, ''),
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

-- Partner storefront (banner, tagline, fast lane). Menus stay admin-managed for now.
create or replace function public.update_storefront(p_tagline text, p_banner_url text, p_fast_lane_minutes int)
returns void language plpgsql security definer set search_path = public as $$
begin
	update stores set
		tagline = nullif(trim(p_tagline), ''),
		banner_url = nullif(trim(p_banner_url), ''),
		fast_lane_minutes = p_fast_lane_minutes
	where id = (select partner_store_id from profiles where id = auth.uid() and role = 'PARTNER')
		and owner_id = auth.uid();
	if not found then raise exception 'PARTNER_ONLY'; end if;
end $$;

-- ============================================================
-- Row-Level Security
-- ============================================================
alter table public.stores enable row level security;
alter table public.menu_items enable row level security;
alter table public.promotions enable row level security;
alter table public.profiles enable row level security;
alter table public.partner_invites enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_secrets enable row level security;
alter table public.chat_messages enable row level security;

-- Catalogue is public
create policy "stores are public" on public.stores for select using (true);
create policy "menus are public" on public.menu_items for select using (true);

-- Promotions: everyone sees live ones; owners see and manage all of their own
create policy "live promotions are public" on public.promotions for select
	using ((active and approved and (ends_at is null or ends_at > now()))
		or store_id in (select id from public.stores where owner_id = auth.uid()));
create policy "owners create promotions" on public.promotions for insert
	with check (store_id in (select id from public.stores where owner_id = auth.uid()));
create policy "owners edit promotions" on public.promotions for update
	using (store_id in (select id from public.stores where owner_id = auth.uid()))
	with check (store_id in (select id from public.stores where owner_id = auth.uid()));
create policy "owners delete promotions" on public.promotions for delete
	using (store_id in (select id from public.stores where owner_id = auth.uid()));

-- Profiles: read and edit your own; role/email/store binding are not client-editable
create policy "read own profile" on public.profiles for select using (id = auth.uid());
create policy "edit own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name, nickname, student_id, faculty, phone, promptpay_no) on public.profiles to authenticated;

-- partner_invites and order_secrets: no policies = no client access

-- Orders: customers and riders see their own; riders can browse open jobs. No direct writes.
create policy "participants read orders" on public.orders for select
	using (auth.uid() in (customer_id, rider_id)
		or (status = 'PENDING' and public.current_role_is('STUDENT')));
create policy "participants read items" on public.order_items for select
	using (exists (select 1 from public.orders o where o.id = order_id
		and (auth.uid() in (o.customer_id, o.rider_id) or (o.status = 'PENDING' and public.current_role_is('STUDENT')))));

create policy "participants read chat" on public.chat_messages for select
	using (public.is_order_participant(order_id));
create policy "participants write chat" on public.chat_messages for insert
	with check (
		sender_id = auth.uid()
		and exists (
			select 1 from public.orders o
			where o.id = order_id and o.status in ('ACCEPTED', 'DELIVERING')
				and ((sender_role = 'CUSTOMER' and o.customer_id = auth.uid())
					or (sender_role = 'RIDER' and o.rider_id = auth.uid()))
		)
	);

-- ============================================================
-- Realtime + Storage
-- ============================================================
alter publication supabase_realtime add table public.orders, public.chat_messages, public.promotions;

insert into storage.buckets (id, name, public) values ('store-banners', 'store-banners', true)
	on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('chat-images', 'chat-images', false)
	on conflict (id) do nothing;

-- store-banners/<store_id>/<file>: public read, owners write
create policy "banner owners write" on storage.objects for insert to authenticated
	with check (bucket_id = 'store-banners'
		and (storage.foldername(name))[1] in (select id from public.stores where owner_id = auth.uid()));
create policy "banner owners update" on storage.objects for update to authenticated
	using (bucket_id = 'store-banners'
		and (storage.foldername(name))[1] in (select id from public.stores where owner_id = auth.uid()));
create policy "banner owners delete" on storage.objects for delete to authenticated
	using (bucket_id = 'store-banners'
		and (storage.foldername(name))[1] in (select id from public.stores where owner_id = auth.uid()));

-- chat-images/<order_id>/<file>: only the two people on the order
create policy "chat images read" on storage.objects for select to authenticated
	using (bucket_id = 'chat-images' and public.is_order_participant(((storage.foldername(name))[1])::uuid));
create policy "chat images write" on storage.objects for insert to authenticated
	with check (bucket_id = 'chat-images' and public.is_order_participant(((storage.foldername(name))[1])::uuid));

-- Only the functions below are callable by signed-in users; trigger internals are not
revoke execute on all functions in schema public from anon, authenticated, public;
grant execute on function
	public.place_order(text, jsonb, text, text, public.payment_method, text),
	public.place_custom_order(text, text, int, text, text),
	public.cancel_order(uuid),
	public.rate_order(uuid, int, text[], int),
	public.accept_order(uuid),
	public.mark_delivering(uuid),
	public.confirm_delivery(uuid, text),
	public.my_orders(uuid),
	public.update_storefront(text, text, int),
	public.is_order_participant(uuid),
	public.current_role_is(public.user_role),
	public.is_kmutt_email(text),
	public.store_delivery_fee(),
	public.custom_delivery_fee()
to authenticated;
