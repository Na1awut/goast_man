-- ============================================================
-- Rider tools: ready/offline status, rider applications, and the round-up tip
--
-- 1. Ready / offline: a rider switches "พร้อมรับงาน" on; the app refreshes it
--    while the rider screen is open. Counted as ready only when refreshed in
--    the last 10 minutes, so a phone put away drops out on its own. Buyers see
--    the real count on the home page (riders_online).
-- 2. Applications: a student applies in the app, the team meets them, and an
--    ADMIN approves (adds them to rider_roster) or rejects with a reason.
-- 3. Round-up tip: at checkout the buyer may round the total up to the next
--    5 baht, the difference being a tip for the rider. It is part of the order
--    total (PromptPay or cash), so the team pays it on with the rider payout.
--    rate_order no longer sets the tip.
-- ============================================================

-- ---------- 1. Ready / offline ----------

create table public.rider_presence (
	rider_id uuid primary key references auth.users on delete cascade,
	online boolean not null default false,
	last_seen timestamptz not null default now()
);
alter table public.rider_presence enable row level security; -- no policies: functions only

-- A ready rider is switched on and seen in the last 10 minutes, and still on the roster
create or replace function public.rider_is_ready(p_rider uuid) returns boolean
language sql stable security definer set search_path = public as $$
	select exists (
		select 1 from rider_presence r
		join profiles p on p.id = r.rider_id
		join rider_roster rr on rr.email = p.email
		where r.rider_id = p_rider and r.online and r.last_seen > now() - interval '10 minutes'
	)
$$;

-- Switch on / off. Called again while the rider screen is open to stay ready.
create or replace function public.set_rider_online(p_online boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
	if not is_rider() then raise exception 'RIDER_ONLY'; end if;
	insert into rider_presence (rider_id, online, last_seen) values (auth.uid(), coalesce(p_online, false), now())
	on conflict (rider_id) do update set online = excluded.online, last_seen = now();
	return coalesce(p_online, false);
end $$;

-- Riders ready right now, for the buyers' home page
create or replace function public.riders_online() returns int
language sql stable security definer set search_path = public as $$
	select count(*)::int from rider_presence r
	join profiles p on p.id = r.rider_id
	join rider_roster rr on rr.email = p.email
	where r.online and r.last_seen > now() - interval '10 minutes'
$$;

-- The board also says whether this rider is switched on, and shows the tip
create or replace function public.rider_board() returns jsonb
language sql stable security definer set search_path = public as $$
	select case when not is_rider() then null else jsonb_build_object(
		'capacity', rider_capacity(),
		'online', rider_is_ready(auth.uid()),
		'open', (
			select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at), '[]'::jsonb)
			from (
				select o.id, o.order_code, o.kind, o.store_id, o.pickup_name, o.dropoff_name, o.item_details,
					o.food_total, o.delivery_fee, o.tip, o.total_price, o.payment_method, o.status, o.note, o.created_at,
					(select jsonb_agg(jsonb_build_object('name', i.name, 'price', i.price, 'quantity', i.quantity))
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
					o.food_total, o.delivery_fee, o.tip, o.total_price, o.payment_method, o.status, o.note, o.created_at,
					o.accepted_at, o.delivering_at,
					(select jsonb_agg(jsonb_build_object('name', i.name, 'price', i.price, 'quantity', i.quantity))
						from order_items i where i.order_id = o.id) as items,
					jsonb_build_object('nickname', p.nickname, 'phone', coalesce(p.phone, '')) as customer
				from orders o join profiles p on p.id = o.customer_id
				where o.rider_id = auth.uid() and o.status in ('ACCEPTED', 'DELIVERING')
			) j
		)
	) end
$$;

-- ---------- 2. Rider applications ----------

create table public.rider_applications (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users on delete cascade,
	email text not null,
	-- When they can run errands, e.g. "จันทร์-พุธ ช่วงเที่ยง"
	availability text not null check (char_length(availability) between 1 and 120),
	note text check (note is null or char_length(note) <= 300),
	status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
	review_note text,
	reviewed_by uuid references auth.users on delete set null,
	reviewed_at timestamptz,
	created_at timestamptz not null default now()
);
alter table public.rider_applications enable row level security; -- no policies: functions only
create unique index rider_applications_one_pending on public.rider_applications (user_id) where status = 'PENDING';

create or replace function public.apply_rider(p_availability text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
	v_uid uuid := auth.uid();
	v_email text;
	v_availability text := trim(coalesce(p_availability, ''));
	v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
	if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
	if not current_role_is('STUDENT') then raise exception 'STUDENT_ONLY'; end if;
	if not profile_ready(v_uid) then raise exception 'PROFILE_REQUIRED'; end if;
	if is_rider() then raise exception 'ALREADY_RIDER'; end if;
	if v_availability = '' or char_length(v_availability) > 120 then raise exception 'BAD_AVAILABILITY'; end if;
	if char_length(coalesce(v_note, '')) > 300 then raise exception 'NOTE_TOO_LONG'; end if;
	select email into v_email from profiles where id = v_uid;
	begin
		insert into rider_applications (user_id, email, availability, note) values (v_uid, v_email, v_availability, v_note);
	exception when unique_violation then
		raise exception 'APPLICATION_PENDING';
	end;
end $$;

-- The signed-in student's latest application (null = never applied)
create or replace function public.my_rider_application() returns jsonb
language sql stable security definer set search_path = public as $$
	select to_jsonb(x) from (
		select a.id, a.status, a.availability, a.note, a.review_note, a.created_at, a.reviewed_at
		from rider_applications a where a.user_id = auth.uid()
		order by a.created_at desc limit 1
	) x
$$;

create or replace function public.admin_rider_applications(p_status text default 'PENDING') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
			select a.id, a.email, a.availability, a.note, a.status, a.review_note, a.created_at, a.reviewed_at,
				(select coalesce(nullif(q.nickname, ''), q.email) from profiles q where q.id = a.reviewed_by) as reviewed_by,
				p.nickname, p.full_name, coalesce(p.student_id, '') as student_id, coalesce(p.phone, '') as phone,
				coalesce(p.faculty, '') as faculty, level_label(p.study_level) as level,
				(select count(*) from orders o where o.customer_id = a.user_id and o.status = 'COMPLETED') as orders_as_buyer
			from rider_applications a left join profiles p on p.id = a.user_id
			where p_status is null or a.status = p_status
			order by a.created_at desc limit 200
		) x
	);
end $$;

-- ADMIN only, like adding a rider by hand. Rejecting needs a reason the student will see.
create or replace function public.admin_review_rider_application(p_id uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
	v_app rider_applications%rowtype;
	v_note text := nullif(trim(coalesce(p_note, '')), '');
	v_name text;
begin
	perform require_team(true);
	select * into v_app from rider_applications where id = p_id for update;
	if v_app.id is null or v_app.status <> 'PENDING' then raise exception 'BAD_STATE'; end if;
	if not coalesce(p_approve, false) and v_note is null then raise exception 'REASON_REQUIRED'; end if;
	update rider_applications
	set status = case when p_approve then 'APPROVED' else 'REJECTED' end, review_note = v_note, reviewed_by = auth.uid(), reviewed_at = now()
	where id = p_id;
	select coalesce(nullif(nickname, ''), email) into v_name from profiles where id = v_app.user_id;
	if p_approve then
		insert into rider_roster (email, note, added_by)
		values (v_app.email, coalesce(v_note, 'สมัครผ่านแอป · ว่าง ' || v_app.availability), auth.uid())
		on conflict (email) do nothing;
	end if;
	perform log_admin(case when p_approve then 'RIDER_APPROVED' else 'RIDER_REJECTED' end, 'rider', v_app.email, coalesce(v_name, v_app.email),
		jsonb_build_object('note', v_note));
end $$;

-- Menu badges in one call: open errors (last 24 h) and applications waiting
create or replace function public.admin_badges() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return jsonb_build_object(
		'errors', (select count(*) from client_errors where resolved_at is null and last_at > now() - interval '24 hours'),
		'rider_applications', (select count(*) from rider_applications where status = 'PENDING')
	);
end $$;

-- The console's rider list also shows who is ready right now
create or replace function public.admin_riders() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(x order by x.busy desc, x.online desc, x.added_at), '[]'::jsonb) from (
			select r.email, r.note, r.added_at,
				(select coalesce(nullif(q.nickname, ''), q.email) from profiles q where q.id = r.added_by) as added_by,
				p.id as user_id, p.nickname, p.full_name, coalesce(p.phone, '') as phone, coalesce(p.faculty, '') as faculty,
				level_label(p.study_level) as level,
				coalesce(rider_is_ready(p.id), false) as online,
				(select pr.last_seen from rider_presence pr where pr.rider_id = p.id) as last_seen,
				(select count(*) from orders o where o.rider_id = p.id and o.status in ('ACCEPTED', 'DELIVERING')) as holding,
				exists (select 1 from orders o where o.rider_id = p.id and o.status = 'DELIVERING') as delivering,
				exists (select 1 from orders o where o.rider_id = p.id and o.status in ('ACCEPTED', 'DELIVERING')) as busy,
				(select count(*) from orders o where o.rider_id = p.id and o.status = 'COMPLETED' and bkk(o.completed_at)::date = bkk_today()) as jobs_today,
				(select count(*) from orders o where o.rider_id = p.id and o.status = 'COMPLETED') as jobs_total,
				(select round(avg(o.rating)::numeric, 1) from orders o where o.rider_id = p.id and o.rating is not null) as rating
			from rider_roster r left join profiles p on p.email = r.email
		) x
	);
end $$;

-- ---------- 3. Round-up tip ----------

-- True when the tip was added to total_price at checkout (so the buyer paid it).
-- Older orders set a tip on the rating screen that nobody paid in; those stay false.
alter table public.orders add column tip_in_total boolean not null default false;

-- One formula for what the team owes the rider for a finished order (mirrors owedToRider in the app)
create or replace function public.rider_owed(o public.orders) returns int
language sql immutable as $$
	select o.food_total + o.delivery_fee + case when o.tip_in_total then o.tip else 0 end
		- case when o.payment_method = 'CASH' then o.total_price else 0 end
$$;

-- Round-up to the next 5 baht only: 52 → 55 (tip 3), 58 → 60 (tip 2). 0 = no tip.
create or replace function public.round_up_tip(p_total int) returns int
language sql immutable as $$
	select (5 - p_total % 5) % 5
$$;

-- place_order plus the tip, in one transaction, so no rider ever sees the total change
create or replace function public.place_order_tipped(
	p_store_id text,
	p_items jsonb,
	p_dropoff text,
	p_note text,
	p_payment public.payment_method,
	p_promo_code text default null,
	p_tip int default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_total int; v_tip int := coalesce(p_tip, 0);
begin
	v_id := place_order(p_store_id, p_items, p_dropoff, p_note, p_payment, p_promo_code);
	if v_tip <> 0 then
		select total_price into v_total from orders where id = v_id;
		if v_tip <> round_up_tip(v_total) then raise exception 'BAD_TIP'; end if;
		update orders set tip = v_tip, tip_in_total = true, total_price = v_total + v_tip where id = v_id;
	end if;
	return v_id;
end $$;

-- Rating no longer touches the tip: it was chosen and paid with the order
create or replace function public.rate_order(p_order_id uuid, p_rating int, p_tags text[], p_tip int)
returns void language plpgsql security definer set search_path = public as $$
begin
	update orders
	set rating = case when p_rating between 1 and 5 then p_rating else null end,
		feedback_tags = coalesce(p_tags, '{}')
	where id = p_order_id and customer_id = auth.uid() and status = 'COMPLETED';
	if not found then raise exception 'CANNOT_RATE'; end if;
end $$;

-- The rider is owed the tip too. PromptPay: food + fee + tip. Cash: the rider
-- collected the total (tip included), so only discounts are owed, as before.
create or replace function public.rider_payouts_due()
returns table (
	order_id uuid, order_code text, completed_at timestamptz,
	rider_id uuid, rider_name text, rider_email text, rider_promptpay text,
	payment_method public.payment_method, food_total int, delivery_fee int, collected_in_cash int, owed int
)
language sql stable security definer set search_path = public as $$
	select o.id, o.order_code, o.completed_at,
		o.rider_id, p.nickname, p.email, coalesce(p.promptpay_no, p.phone),
		o.payment_method, o.food_total, o.delivery_fee,
		case when o.payment_method = 'CASH' then o.total_price else 0 end,
		rider_owed(o)
	from orders o join profiles p on p.id = o.rider_id
	where o.status = 'COMPLETED' and o.payout_paid_at is null and rider_owed(o) > 0
	order by p.nickname, o.completed_at
$$;

-- ---------- Grants ----------

revoke execute on function public.rider_is_ready(uuid), public.rider_owed(public.orders) from anon, authenticated, public;
grant execute on function public.riders_online() to anon, authenticated;
grant execute on function
	public.set_rider_online(boolean), public.apply_rider(text, text), public.my_rider_application(),
	public.place_order_tipped(text, jsonb, text, text, public.payment_method, text, int), public.round_up_tip(int),
	public.admin_rider_applications(text), public.admin_review_rider_application(uuid, boolean, text), public.admin_badges()
to authenticated;
revoke execute on function
	public.set_rider_online(boolean), public.apply_rider(text, text), public.my_rider_application(),
	public.place_order_tipped(text, jsonb, text, text, public.payment_method, text, int),
	public.admin_rider_applications(text), public.admin_review_rider_application(uuid, boolean, text), public.admin_badges()
from anon, public;
