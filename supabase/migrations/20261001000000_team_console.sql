-- ============================================================
-- Team console (goastman.dev): STAFF / ADMIN roles, activity log and
-- one checked function per button, so the team never edits tables by hand.
--
-- Team members are listed by email in team_members (like rider_roster).
-- Every admin_* function checks the caller's team role on the server and
-- writes admin_log; the page hiding a button is only a convenience.
--
-- First admin (run once in the SQL Editor):
--   insert into team_members (email, role, note) values ('<email>', 'ADMIN', 'first admin');
-- ============================================================

create table public.team_members (
	email text primary key check (email = lower(email)),
	role text not null check (role in ('ADMIN', 'STAFF')),
	note text,
	added_by uuid references auth.users on delete set null,
	added_at timestamptz not null default now()
);
alter table public.team_members enable row level security; -- no policies: functions only

create table public.admin_log (
	id bigint generated always as identity primary key,
	actor_id uuid references auth.users on delete set null,
	actor_name text not null default '',
	action text not null,
	target_type text not null,
	target_id text not null,
	target_label text not null default '',
	detail jsonb not null default '{}',
	created_at timestamptz not null default now()
);
create index admin_log_created_idx on public.admin_log (created_at desc);
create index admin_log_target_idx on public.admin_log (target_type, target_id, created_at desc);
alter table public.admin_log enable row level security; -- no policies: functions only

-- What the team changes on an order, and when a job was cancelled
alter table public.orders
	add column cancelled_at timestamptz,
	add column cancelled_by uuid references auth.users on delete set null,
	add column cancel_reason text,
	add column payment_confirmed_by uuid references auth.users on delete set null,
	add column refunded_at timestamptz,
	add column refund_ref text,
	add column refunded_by uuid references auth.users on delete set null;

alter table public.rider_roster add column added_by uuid references auth.users on delete set null;

alter table public.promotions
	add column review_note text,
	add column reviewed_at timestamptz,
	add column reviewed_by uuid references auth.users on delete set null;

-- One row per transfer the team made to a rider
create table public.payout_batches (
	id uuid primary key default gen_random_uuid(),
	rider_id uuid references auth.users on delete set null,
	amount int not null check (amount > 0),
	order_ids uuid[] not null,
	transfer_ref text,
	paid_by uuid references auth.users on delete set null,
	paid_at timestamptz not null default now()
);
alter table public.payout_batches enable row level security; -- no policies: functions only

-- Every path to CANCELLED gets a timestamp (buyer cancel included)
create or replace function public.stamp_cancelled() returns trigger
language plpgsql as $$
begin
	if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' and new.cancelled_at is null then
		new.cancelled_at := now();
	end if;
	return new;
end $$;
create trigger orders_stamp_cancelled before update of status on public.orders
	for each row execute function public.stamp_cancelled();

-- ---------- Roles ----------

-- 'ADMIN', 'STAFF' or null for the signed-in user
create or replace function public.team_role() returns text
language sql stable security definer set search_path = public as $$
	select t.role from team_members t join profiles p on p.email = t.email where p.id = auth.uid()
$$;

-- Raises TEAM_ONLY / ADMIN_ONLY unless the caller has the role
create or replace function public.require_team(p_admin boolean default false) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_role text := team_role();
begin
	if v_role is null then raise exception 'TEAM_ONLY'; end if;
	if p_admin and v_role <> 'ADMIN' then raise exception 'ADMIN_ONLY'; end if;
	return v_role;
end $$;

create or replace function public.log_admin(p_action text, p_type text, p_id text, p_label text, p_detail jsonb default '{}')
returns void language sql security definer set search_path = public as $$
	insert into admin_log (actor_id, actor_name, action, target_type, target_id, target_label, detail)
	select auth.uid(), coalesce(nullif(p.nickname, ''), p.full_name, p.email, ''), p_action, p_type, p_id, coalesce(p_label, ''), coalesce(p_detail, '{}')
	from (select 1) one left join profiles p on p.id = auth.uid()
$$;

-- Joint promotions: team admins approve them too (was: profile role ADMIN only)
create or replace function public.guard_promotion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	-- No signed-in user = SQL editor, seed or service role: trust as admin
	if auth.uid() is null or public.current_role_is('ADMIN') or public.team_role() = 'ADMIN' then
		return new;
	end if;
	if new.kind = 'DEAL' then
		new.approved := true;
	elsif tg_op = 'INSERT' then
		new.approved := false;
	elsif (new.title, new.description, new.min_qty, new.discount, new.free_delivery, new.banner_url, new.ends_at, new.kind)
		is distinct from
		(old.title, old.description, old.min_qty, old.discount, old.free_delivery, old.banner_url, old.ends_at, old.kind) then
		new.approved := false;
	else
		new.approved := old.approved;
	end if;
	return new;
end $$;

-- ---------- Time: the campus runs on Bangkok time (UTC+7, no DST) ----------

create or replace function public.bkk(p_ts timestamptz) returns timestamp
language sql immutable as $$ select (p_ts at time zone 'UTC') + interval '7 hours' $$;

create or replace function public.bkk_today() returns date
language sql stable as $$ select bkk(now())::date $$;

-- ---------- Order views ----------

-- Problems a person has to look at, most urgent first:
-- OTP_LOCKED, REFUND_DUE, LATE (40+ min), UNASSIGNED (10+ min without a rider), UNPAID (15+ min)
create or replace function public.order_attention(o public.orders, p_failed int) returns jsonb
language sql stable as $$
	select coalesce(jsonb_agg(a order by a ->> 'rank'), '[]'::jsonb) from (
		select jsonb_build_object('code', 'OTP_LOCKED', 'rank', 1) a where o.status = 'DELIVERING' and p_failed >= 5
		union all
		select jsonb_build_object('code', 'REFUND_DUE', 'rank', 2, 'amount', o.total_price)
			where o.status = 'CANCELLED' and o.paid_at is not null and o.refunded_at is null
		union all
		select jsonb_build_object('code', 'LATE', 'rank', 3, 'minutes', floor(extract(epoch from now() - o.created_at) / 60)::int)
			where o.status in ('ACCEPTED', 'DELIVERING') and now() - o.created_at > interval '40 minutes'
		union all
		select jsonb_build_object('code', 'UNASSIGNED', 'rank', 4,
				'minutes', floor(extract(epoch from now() - coalesce(o.paid_at, o.created_at)) / 60)::int)
			where o.status = 'PENDING' and (o.payment_method = 'CASH' or o.paid_at is not null)
				and now() - coalesce(o.paid_at, o.created_at) > interval '10 minutes'
		union all
		select jsonb_build_object('code', 'UNPAID', 'rank', 5, 'minutes', floor(extract(epoch from now() - o.created_at) / 60)::int)
			where o.status = 'PENDING' and o.payment_method = 'PROMPTPAY' and o.paid_at is null
				and now() - o.created_at > interval '15 minutes'
	) x
$$;

-- PENDING splits into "waiting for payment" and "waiting for a rider" for the team
create or replace function public.order_stage(o public.orders) returns text
language sql immutable as $$
	select case when o.status = 'PENDING' and o.payment_method = 'PROMPTPAY' and o.paid_at is null
		then 'AWAITING_PAYMENT' else o.status::text end
$$;

create or replace function public.order_row(o public.orders) returns jsonb
language sql stable security definer set search_path = public as $$
	select jsonb_build_object(
		'id', o.id, 'code', o.order_code, 'kind', o.kind, 'stage', order_stage(o), 'status', o.status,
		'created_at', o.created_at, 'store_id', o.store_id, 'pickup', o.pickup_name, 'dropoff', o.dropoff_name,
		'total', o.total_price, 'payment', o.payment_method, 'paid_at', o.paid_at,
		'customer', (select nullif(p.nickname, '') from profiles p where p.id = o.customer_id),
		'rider', (select nullif(p.nickname, '') from profiles p where p.id = o.rider_id),
		'attention', order_attention(o, coalesce((select s.failed_attempts from order_secrets s where s.order_id = o.id), 0))
	)
$$;

-- Orders list. p_tab: attention | active | awaiting_payment | done | cancelled | all.
-- attention looks at every day (problems do not expire at midnight); the rest use p_day.
create or replace function public.admin_orders(
	p_tab text default 'attention', p_day date default null, p_store text default null,
	p_payment text default null, p_search text default null, p_limit int default 50, p_offset int default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
	v_day date := coalesce(p_day, bkk_today());
	v_q text := nullif(trim(coalesce(p_search, '')), '');
	v_digits text := nullif(regexp_replace(coalesce(p_search, ''), '\D', '', 'g'), '');
begin
	perform require_team();
	return (
		with base as (
			select o.*, order_row(o) as r, order_stage(o) as stage
			from orders o
			where (p_store is null or o.store_id = p_store)
				and (p_payment is null or o.payment_method::text = p_payment)
				and (v_q is null
					or o.order_code ilike '%' || v_q || '%'
					or (v_digits is not null and length(v_digits) >= 4 and o.order_code like '%' || v_digits || '%')
					or exists (select 1 from profiles p where p.id in (o.customer_id, o.rider_id)
						and (p.nickname ilike '%' || v_q || '%' or (v_digits is not null and length(v_digits) >= 4 and p.phone like '%' || v_digits || '%'))))
		),
		dayrows as (select * from base where bkk(created_at)::date = v_day),
		tabbed as (
			select * from base where p_tab = 'attention' and jsonb_array_length(r -> 'attention') > 0
			union all select * from dayrows where p_tab = 'active' and status in ('PENDING', 'ACCEPTED', 'DELIVERING') and stage <> 'AWAITING_PAYMENT'
			union all select * from dayrows where p_tab = 'awaiting_payment' and stage = 'AWAITING_PAYMENT'
			union all select * from dayrows where p_tab = 'done' and status = 'COMPLETED'
			union all select * from dayrows where p_tab = 'cancelled' and status = 'CANCELLED'
			union all select * from dayrows where p_tab = 'all'
		)
		select jsonb_build_object(
			'rows', coalesce((
				select jsonb_agg(t.r order by
					case when p_tab = 'attention' then (t.r -> 'attention' -> 0 ->> 'rank')::int end,
					case when p_tab = 'attention' then t.created_at end asc,
					t.created_at desc)
				from (select * from tabbed order by
					case when p_tab = 'attention' then (r -> 'attention' -> 0 ->> 'rank')::int end,
					case when p_tab = 'attention' then created_at end asc,
					created_at desc
					limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset)) t
			), '[]'::jsonb),
			'total', (select count(*) from tabbed),
			'counts', jsonb_build_object(
				'attention', (select count(*) from base where jsonb_array_length(r -> 'attention') > 0),
				'active', (select count(*) from dayrows where status in ('PENDING', 'ACCEPTED', 'DELIVERING') and stage <> 'AWAITING_PAYMENT'),
				'awaiting_payment', (select count(*) from dayrows where stage = 'AWAITING_PAYMENT'),
				'done', (select count(*) from dayrows where status = 'COMPLETED'),
				'cancelled', (select count(*) from dayrows where status = 'CANCELLED'),
				'all', (select count(*) from dayrows)
			)
		)
	);
end $$;

-- Everything the order panel shows. Never the OTP itself, only failed attempts.
create or replace function public.admin_order(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o orders%rowtype;
begin
	perform require_team();
	select * into o from orders where id = p_order_id;
	if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
	return order_row(o) || jsonb_build_object(
		'note', o.note, 'food_total', o.food_total, 'delivery_fee', o.delivery_fee,
		'code_discount', o.code_discount, 'partner_discount', o.partner_discount, 'promo_code', o.promo_code,
		'slip_ref', o.slip_ref, 'accepted_at', o.accepted_at, 'delivering_at', o.delivering_at,
		'completed_at', o.completed_at, 'cancelled_at', o.cancelled_at, 'cancel_reason', o.cancel_reason,
		'cancelled_by', (select coalesce(nullif(p.nickname, ''), p.email) from profiles p where p.id = o.cancelled_by),
		'payment_confirmed_by', (select coalesce(nullif(p.nickname, ''), p.email) from profiles p where p.id = o.payment_confirmed_by),
		'refunded_at', o.refunded_at, 'refund_ref', o.refund_ref,
		'payout_paid_at', o.payout_paid_at, 'rating', o.rating, 'tip', o.tip,
		'otp_failed', coalesce((select s.failed_attempts from order_secrets s where s.order_id = o.id), 0),
		'store', (select jsonb_build_object('id', s.id, 'name', s.name, 'lock', s.lock, 'image_url', s.image_url) from stores s where s.id = o.store_id),
		'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.name, 'price', i.price, 'quantity', i.quantity) order by i.name)
			from order_items i where i.order_id = o.id), '[]'::jsonb),
		'customer_info', (select jsonb_build_object('nickname', p.nickname, 'full_name', p.full_name, 'phone', coalesce(p.phone, ''),
			'promptpay', coalesce(p.promptpay_no, p.phone, ''), 'faculty', coalesce(p.faculty, ''), 'level', level_label(p.study_level))
			from profiles p where p.id = o.customer_id),
		'rider_info', (select jsonb_build_object('nickname', p.nickname, 'full_name', p.full_name, 'phone', coalesce(p.phone, ''),
			'faculty', coalesce(p.faculty, ''), 'level', level_label(p.study_level),
			'holding', (select count(*) from orders r where r.rider_id = p.id and r.status in ('ACCEPTED', 'DELIVERING')))
			from profiles p where p.id = o.rider_id),
		'activity', coalesce((select jsonb_agg(jsonb_build_object('at', l.created_at, 'by', l.actor_name, 'action', l.action, 'detail', l.detail) order by l.created_at desc)
			from admin_log l where l.target_type = 'order' and l.target_id = o.id::text), '[]'::jsonb)
	);
end $$;

-- ---------- Order actions ----------

create or replace function public.admin_cancel_order(p_order_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
	perform require_team();
	if v_reason is null then raise exception 'REASON_REQUIRED'; end if;
	select * into o from orders where id = p_order_id for update;
	if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
	if o.status in ('COMPLETED', 'CANCELLED') then raise exception 'BAD_STATE'; end if;
	update orders set status = 'CANCELLED', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = v_reason where id = o.id;
	perform log_admin('ORDER_CANCELLED', 'order', o.id::text, o.order_code,
		jsonb_build_object('reason', v_reason, 'was', order_stage(o), 'refund_due', o.paid_at is not null));
end $$;

-- The buyer transferred but the automatic slip check failed: the team checked the bank app
create or replace function public.admin_confirm_payment(p_order_id uuid, p_bank_ref text) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; v_ref text := nullif(trim(coalesce(p_bank_ref, '')), '');
begin
	perform require_team();
	if v_ref is null then raise exception 'REF_REQUIRED'; end if;
	select * into o from orders where id = p_order_id for update;
	if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
	if o.payment_method <> 'PROMPTPAY' or o.status <> 'PENDING' then raise exception 'ORDER_NOT_PAYABLE'; end if;
	if o.paid_at is not null then raise exception 'ALREADY_PAID'; end if;
	begin
		update orders set paid_at = now(), slip_ref = 'MANUAL:' || v_ref, payment_confirmed_by = auth.uid() where id = o.id;
	exception when unique_violation then
		raise exception 'SLIP_USED';
	end;
	insert into chat_messages (order_id, sender_role, body) values (o.id, 'SYSTEM', 'ได้รับชำระเงินแล้ว กำลังหาเพื่อนรับหิ้ว');
	perform log_admin('PAYMENT_CONFIRMED', 'order', o.id::text, o.order_code, jsonb_build_object('amount', o.total_price, 'ref', v_ref));
end $$;

create or replace function public.admin_unlock_otp(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
	perform require_team();
	select * into o from orders where id = p_order_id;
	if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
	update order_secrets set failed_attempts = 0 where order_id = o.id and failed_attempts >= 5;
	if not found then raise exception 'NOT_LOCKED'; end if;
	perform log_admin('OTP_UNLOCKED', 'order', o.id::text, o.order_code);
end $$;

-- Take a job back from a rider who has not collected the food yet
create or replace function public.admin_requeue_order(p_order_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
	perform require_team();
	if v_reason is null then raise exception 'REASON_REQUIRED'; end if;
	select * into o from orders where id = p_order_id for update;
	if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
	if o.status <> 'ACCEPTED' then raise exception 'BAD_STATE'; end if;
	update orders set status = 'PENDING', rider_id = null, accepted_at = null where id = o.id;
	perform log_admin('ORDER_REQUEUED', 'order', o.id::text, o.order_code,
		jsonb_build_object('reason', v_reason, 'rider', (select nickname from profiles where id = o.rider_id)));
end $$;

create or replace function public.admin_mark_refunded(p_order_id uuid, p_ref text) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; v_ref text := nullif(trim(coalesce(p_ref, '')), '');
begin
	perform require_team();
	if v_ref is null then raise exception 'REF_REQUIRED'; end if;
	select * into o from orders where id = p_order_id for update;
	if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
	if o.status <> 'CANCELLED' or o.paid_at is null or o.refunded_at is not null then raise exception 'BAD_STATE'; end if;
	update orders set refunded_at = now(), refund_ref = v_ref, refunded_by = auth.uid() where id = o.id;
	perform log_admin('REFUNDED', 'order', o.id::text, o.order_code, jsonb_build_object('amount', o.total_price, 'ref', v_ref));
end $$;

-- ---------- Overview ----------

create or replace function public.admin_overview(p_day date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_day date := coalesce(p_day, bkk_today());
begin
	perform require_team();
	return (
		with dayrows as (select o.*, order_stage(o) as stage from orders o where bkk(o.created_at)::date = v_day),
		live as (select o.* from orders o where o.status in ('PENDING', 'ACCEPTED', 'DELIVERING')),
		due as (select * from rider_payouts_due()),
		slots as (
			-- 15-minute buckets over the lunch window, widened to any order outside it
			select gs as slot_start
			from generate_series(
				least(v_day + time '10:30', (select date_trunc('hour', min(bkk(created_at))) from dayrows)),
				greatest(v_day + time '13:15', (select max(bkk(created_at)) from dayrows)),
				interval '15 minutes') gs
		),
		problems as (
			select o.id from orders o
			where jsonb_array_length(order_attention(o, coalesce((select s.failed_attempts from order_secrets s where s.order_id = o.id), 0))) > 0
		)
		select jsonb_build_object(
			'day', v_day,
			'is_today', v_day = bkk_today(),
			'orders', (select count(*) from dayrows),
			'gmv', (select coalesce(sum(total_price), 0) from dayrows where status <> 'CANCELLED'),
			'food', (select coalesce(sum(food_total), 0) from dayrows where status <> 'CANCELLED'),
			'fees', (select coalesce(sum(delivery_fee), 0) from dayrows where status <> 'CANCELLED'),
			'waiting_rider', (select count(*) from live where status = 'PENDING' and (payment_method = 'CASH' or paid_at is not null)),
			'awaiting_payment', (select count(*) from live where status = 'PENDING' and payment_method = 'PROMPTPAY' and paid_at is null),
			'delivering', (select count(*) from live where status in ('ACCEPTED', 'DELIVERING')),
			'stores_open', (select count(*) from stores where is_open),
			'stores_total', (select count(*) from stores),
			'riders_busy', (select count(distinct rider_id) from live where rider_id is not null),
			'riders_total', (select count(*) from rider_roster),
			'refunds_due', (select count(*) from orders where status = 'CANCELLED' and paid_at is not null and refunded_at is null),
			'refunds_due_amount', (select coalesce(sum(total_price), 0) from orders where status = 'CANCELLED' and paid_at is not null and refunded_at is null),
			'rider_cost_day', (select coalesce(sum(food_total + delivery_fee - case when payment_method = 'CASH' then total_price else 0 end), 0)
				from orders where status = 'COMPLETED' and bkk(completed_at)::date = v_day),
			'payouts_due', (select coalesce(sum(owed), 0) from due),
			'payouts_due_riders', (select count(distinct rider_id) from due),
			'avg_accept_minutes', (select round(avg(extract(epoch from accepted_at - coalesce(paid_at, created_at)) / 60)::numeric, 1)
				from dayrows where accepted_at is not null),
			'problems', (select count(*) from problems),
			'slots', (
				select coalesce(jsonb_agg(jsonb_build_object(
					'at', to_char(s.slot_start, 'HH24:MI'),
					'orders', (select count(*) from dayrows d where bkk(d.created_at) >= s.slot_start and bkk(d.created_at) < s.slot_start + interval '15 minutes'),
					'gmv', (select coalesce(sum(d.total_price), 0) from dayrows d where d.status <> 'CANCELLED'
						and bkk(d.created_at) >= s.slot_start and bkk(d.created_at) < s.slot_start + interval '15 minutes')
				) order by s.slot_start), '[]'::jsonb)
				from slots s
			),
			'status_counts', jsonb_build_object(
				'AWAITING_PAYMENT', (select count(*) from dayrows where stage = 'AWAITING_PAYMENT'),
				'PENDING', (select count(*) from dayrows where stage = 'PENDING'),
				'ACCEPTED', (select count(*) from dayrows where status = 'ACCEPTED'),
				'DELIVERING', (select count(*) from dayrows where status = 'DELIVERING'),
				'COMPLETED', (select count(*) from dayrows where status = 'COMPLETED'),
				'CANCELLED', (select count(*) from dayrows where status = 'CANCELLED')
			),
			'top_stores', (
				select coalesce(jsonb_agg(t order by t.orders desc, t.gmv desc), '[]'::jsonb) from (
					select s.id, s.name, count(d.id) as orders, coalesce(sum(d.total_price) filter (where d.status <> 'CANCELLED'), 0) as gmv
					from dayrows d join stores s on s.id = d.store_id
					group by s.id, s.name order by orders desc, gmv desc limit 5
				) t
			),
			'riders', (
				select coalesce(jsonb_agg(x order by x.busy desc, x.nickname), '[]'::jsonb) from (
					select p.id, coalesce(nullif(p.nickname, ''), r.email) as nickname,
						j.order_code as job_code, j.pickup_name as job_pickup, j.dropoff_name as job_dropoff, j.status as job_status,
						(select count(*) from live l where l.rider_id = p.id) as holding,
						j.id is not null as busy
					from rider_roster r
					left join profiles p on p.email = r.email
					left join lateral (
						select l.* from live l where l.rider_id = p.id
						order by (l.status = 'DELIVERING') desc, l.accepted_at limit 1
					) j on true
					order by busy desc, nickname limit 8
				) x
			)
		)
	);
end $$;

-- ---------- Money ----------

create or replace function public.admin_payouts() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(r order by r.oldest), '[]'::jsonb) from (
			select d.rider_id, max(d.rider_name) as name, max(d.rider_email) as email, max(d.rider_promptpay) as promptpay,
				(select coalesce(p.faculty, '') from profiles p where p.id = d.rider_id) as faculty,
				(select level_label(p.study_level) from profiles p where p.id = d.rider_id) as level,
				sum(d.owed) as owed, count(*) as jobs, min(d.completed_at) as oldest,
				jsonb_agg(jsonb_build_object('order_id', d.order_id, 'code', d.order_code, 'completed_at', d.completed_at,
					'payment', d.payment_method, 'food', d.food_total, 'fee', d.delivery_fee, 'cash', d.collected_in_cash, 'owed', d.owed)
					order by d.completed_at) as orders
			from rider_payouts_due() d group by d.rider_id
		) r
	);
end $$;

-- Pays every listed order of one rider; the amount is recomputed here, never taken from the page
create or replace function public.admin_mark_payout(p_rider_id uuid, p_order_ids uuid[], p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ids uuid[]; v_amount int; v_batch uuid; v_name text;
begin
	perform require_team();
	select array_agg(order_id), sum(owed) into v_ids, v_amount
	from rider_payouts_due() where rider_id = p_rider_id and order_id = any(p_order_ids);
	if v_ids is null or coalesce(array_length(v_ids, 1), 0) <> coalesce(array_length(p_order_ids, 1), -1) then
		raise exception 'PAYOUT_CHANGED';
	end if;
	perform mark_payout_paid(v_ids, p_ref);
	insert into payout_batches (rider_id, amount, order_ids, transfer_ref, paid_by)
	values (p_rider_id, v_amount, v_ids, nullif(trim(coalesce(p_ref, '')), ''), auth.uid()) returning id into v_batch;
	select coalesce(nullif(nickname, ''), email) into v_name from profiles where id = p_rider_id;
	perform log_admin('PAYOUT_PAID', 'rider', p_rider_id::text, v_name,
		jsonb_build_object('amount', v_amount, 'jobs', array_length(v_ids, 1), 'ref', nullif(trim(coalesce(p_ref, '')), '')));
	return jsonb_build_object('batch_id', v_batch, 'amount', v_amount);
end $$;

create or replace function public.admin_refunds_due() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(jsonb_build_object(
			'order_id', o.id, 'code', o.order_code, 'amount', o.total_price, 'cancelled_at', o.cancelled_at, 'reason', o.cancel_reason,
			'cancelled_by', (select coalesce(nullif(p.nickname, ''), p.email) from profiles p where p.id = o.cancelled_by),
			'customer', (select p.nickname from profiles p where p.id = o.customer_id),
			'phone', (select coalesce(p.phone, '') from profiles p where p.id = o.customer_id),
			'promptpay', (select coalesce(p.promptpay_no, p.phone, '') from profiles p where p.id = o.customer_id)
		) order by o.cancelled_at), '[]'::jsonb)
		from orders o where o.status = 'CANCELLED' and o.paid_at is not null and o.refunded_at is null
	);
end $$;

create or replace function public.admin_money_history(p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_from date := coalesce(p_from, bkk_today() - 30); v_to date := coalesce(p_to, bkk_today());
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(h order by h.at desc), '[]'::jsonb) from (
			select 'PAYOUT' as kind, b.paid_at as at, coalesce(nullif(p.nickname, ''), p.email, '') as recipient, b.amount,
				array_length(b.order_ids, 1) as jobs, b.transfer_ref as ref,
				(select coalesce(nullif(q.nickname, ''), q.email) from profiles q where q.id = b.paid_by) as by
			from payout_batches b left join profiles p on p.id = b.rider_id
			where bkk(b.paid_at)::date between v_from and v_to
			union all
			select 'REFUND', o.refunded_at, coalesce((select nickname from profiles where id = o.customer_id), ''), o.total_price,
				1, o.refund_ref, (select coalesce(nullif(q.nickname, ''), q.email) from profiles q where q.id = o.refunded_by)
			from orders o where o.refunded_at is not null and bkk(o.refunded_at)::date between v_from and v_to
		) h
	);
end $$;

-- ---------- Stores and menu ----------

create or replace function public.admin_stores() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(jsonb_build_object(
			'id', s.id, 'name', s.name, 'category', s.category, 'lock', s.lock, 'image_url', s.image_url, 'logo_url', s.logo_url,
			'is_open', s.is_open, 'is_partner', s.is_partner, 'zone', s.zone,
			'orders_today', (select count(*) from orders o where o.store_id = s.id and bkk(o.created_at)::date = bkk_today()),
			'items_total', (select count(*) from menu_items m where m.store_id = s.id),
			'items_off', (select count(*) from menu_items m where m.store_id = s.id and not m.is_available)
		) order by s.lock, s.name), '[]'::jsonb)
		from stores s
	);
end $$;

create or replace function public.admin_store_menu(p_store_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'price', m.price, 'special_price', m.special_price,
			'category', m.category, 'is_available', m.is_available) order by m.sort, m.id), '[]'::jsonb)
		from menu_items m where m.store_id = p_store_id
	);
end $$;

create or replace function public.admin_set_store_open(p_store_id text, p_open boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
	perform require_team();
	update stores set is_open = p_open where id = p_store_id returning name into v_name;
	if v_name is null then raise exception 'STORE_NOT_FOUND'; end if;
	perform log_admin(case when p_open then 'STORE_OPENED' else 'STORE_CLOSED' end, 'store', p_store_id, v_name);
end $$;

create or replace function public.admin_set_item_available(p_item_id text, p_available boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_item text; v_store text; v_store_id text;
begin
	perform require_team();
	update menu_items set is_available = p_available where id = p_item_id returning name, store_id into v_item, v_store_id;
	if v_item is null then raise exception 'ITEM_NOT_FOUND'; end if;
	select name into v_store from stores where id = v_store_id;
	perform log_admin(case when p_available then 'ITEM_ON' else 'ITEM_OFF' end, 'store', v_store_id, v_store,
		jsonb_build_object('item_id', p_item_id, 'item', v_item));
end $$;

-- ---------- Riders ----------

create or replace function public.admin_riders() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(x order by x.busy desc, x.added_at), '[]'::jsonb) from (
			select r.email, r.note, r.added_at,
				(select coalesce(nullif(q.nickname, ''), q.email) from profiles q where q.id = r.added_by) as added_by,
				p.id as user_id, p.nickname, p.full_name, coalesce(p.phone, '') as phone, coalesce(p.faculty, '') as faculty,
				level_label(p.study_level) as level,
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

create or replace function public.admin_add_rider(p_email text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email, '')));
begin
	perform require_team(true);
	if not is_kmutt_email(v_email) or v_email !~ '^[^@\s]+@[^@\s]+$' then raise exception 'KMUTT_ONLY'; end if;
	if exists (select 1 from rider_roster where email = v_email) then raise exception 'ALREADY_RIDER'; end if;
	insert into rider_roster (email, note, added_by) values (v_email, nullif(trim(coalesce(p_note, '')), ''), auth.uid());
	perform log_admin('RIDER_ADDED', 'rider', v_email, v_email, jsonb_build_object('note', nullif(trim(coalesce(p_note, '')), '')));
end $$;

create or replace function public.admin_remove_rider(p_email text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email, '')));
begin
	perform require_team(true);
	if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'REASON_REQUIRED'; end if;
	delete from rider_roster where email = v_email;
	if not found then raise exception 'NOT_A_RIDER'; end if;
	perform log_admin('RIDER_REMOVED', 'rider', v_email, v_email, jsonb_build_object('reason', trim(p_reason)));
end $$;

-- ---------- Partners and promotions ----------

create or replace function public.admin_promotions() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(jsonb_build_object(
			'id', pr.id, 'store_id', pr.store_id, 'store', s.name, 'store_image', coalesce(s.logo_url, s.image_url), 'kind', pr.kind,
			'title', pr.title, 'description', pr.description, 'min_qty', pr.min_qty, 'discount', pr.discount,
			'free_delivery', pr.free_delivery, 'ends_at', pr.ends_at, 'active', pr.active, 'approved', pr.approved,
			'created_at', pr.created_at, 'review_note', pr.review_note,
			'state', case
				when pr.ends_at is not null and pr.ends_at <= now() then 'ENDED'
				when not pr.active and pr.review_note is not null and not pr.approved then 'REJECTED'
				when not pr.active then 'OFF'
				when pr.kind = 'CO_PROMO' and not pr.approved then 'PENDING'
				else 'LIVE' end,
			'uses', (select count(*) from orders o where o.promotion_id = pr.id and o.status <> 'CANCELLED')
		) order by pr.created_at desc), '[]'::jsonb)
		from promotions pr join stores s on s.id = pr.store_id
	);
end $$;

create or replace function public.admin_review_promo(p_promo_id uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare pr promotions%rowtype; v_store text; v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
	perform require_team(true);
	select * into pr from promotions where id = p_promo_id for update;
	if pr.id is null then raise exception 'PROMO_NOT_FOUND'; end if;
	if pr.kind <> 'CO_PROMO' then raise exception 'BAD_STATE'; end if;
	if not p_approve and v_note is null then raise exception 'REASON_REQUIRED'; end if;
	update promotions set approved = p_approve, active = p_approve, review_note = case when p_approve then null else v_note end,
		reviewed_at = now(), reviewed_by = auth.uid()
	where id = pr.id;
	select name into v_store from stores where id = pr.store_id;
	perform log_admin(case when p_approve then 'PROMO_APPROVED' else 'PROMO_REJECTED' end, 'promotion', pr.id::text,
		v_store || ' · ' || pr.title, jsonb_build_object('note', v_note));
end $$;

create or replace function public.admin_set_promo_active(p_promo_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare pr promotions%rowtype; v_store text;
begin
	perform require_team(true);
	update promotions set active = p_active where id = p_promo_id returning * into pr;
	if pr.id is null then raise exception 'PROMO_NOT_FOUND'; end if;
	select name into v_store from stores where id = pr.store_id;
	perform log_admin(case when p_active then 'PROMO_ON' else 'PROMO_OFF' end, 'promotion', pr.id::text, v_store || ' · ' || pr.title);
end $$;

create or replace function public.admin_partners() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return jsonb_build_object(
		'partners', (select coalesce(jsonb_agg(jsonb_build_object('store_id', s.id, 'store', s.name, 'owner_email', p.email,
			'owner_name', coalesce(nullif(p.nickname, ''), p.full_name), 'joined_at', p.created_at) order by s.lock), '[]'::jsonb)
			from stores s join profiles p on p.id = s.owner_id where s.is_partner),
		'invites', (select coalesce(jsonb_agg(jsonb_build_object('email', i.email, 'store_id', i.store_id, 'store', s.name,
			'invited_at', i.created_at) order by i.created_at desc), '[]'::jsonb)
			from partner_invites i join stores s on s.id = i.store_id)
	);
end $$;

create or replace function public.admin_invite_partner(p_email text, p_store_id text) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_store text;
begin
	perform require_team(true);
	if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'BAD_EMAIL'; end if;
	select name into v_store from stores where id = p_store_id;
	if v_store is null then raise exception 'STORE_NOT_FOUND'; end if;
	if exists (select 1 from stores where id = p_store_id and owner_id is not null) then raise exception 'STORE_HAS_OWNER'; end if;
	if exists (select 1 from profiles where email = v_email) then raise exception 'EMAIL_HAS_ACCOUNT'; end if;
	insert into partner_invites (email, store_id) values (v_email, p_store_id)
	on conflict (email) do update set store_id = excluded.store_id, created_at = now();
	perform log_admin('PARTNER_INVITED', 'store', p_store_id, v_store, jsonb_build_object('email', v_email));
end $$;

create or replace function public.admin_cancel_invite(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_store text;
begin
	perform require_team(true);
	delete from partner_invites where email = lower(trim(coalesce(p_email, ''))) returning store_id into v_store;
	if v_store is null then raise exception 'INVITE_NOT_FOUND'; end if;
	perform log_admin('INVITE_CANCELLED', 'store', v_store, (select name from stores where id = v_store), jsonb_build_object('email', lower(trim(p_email))));
end $$;

-- ---------- Team ----------

-- Who am I on the team? null = not a member (the page shows "no access")
create or replace function public.team_me() returns jsonb
language sql stable security definer set search_path = public as $$
	select jsonb_build_object('email', p.email, 'role', t.role, 'nickname', coalesce(nullif(p.nickname, ''), split_part(p.full_name, ' ', 1)),
		'full_name', p.full_name)
	from profiles p join team_members t on t.email = p.email where p.id = auth.uid()
$$;

create or replace function public.admin_team() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team(true);
	return (
		select coalesce(jsonb_agg(jsonb_build_object('email', t.email, 'role', t.role, 'note', t.note, 'added_at', t.added_at,
			'added_by', (select coalesce(nullif(q.nickname, ''), q.email) from profiles q where q.id = t.added_by),
			'name', coalesce(nullif(p.nickname, ''), p.full_name), 'full_name', p.full_name, 'has_account', p.id is not null,
			'is_me', p.id = auth.uid()
		) order by t.role, t.added_at), '[]'::jsonb)
		from team_members t left join profiles p on p.email = t.email
	);
end $$;

create or replace function public.admin_set_member(p_email text, p_role text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_old text;
begin
	perform require_team(true);
	if p_role not in ('ADMIN', 'STAFF') then raise exception 'BAD_ROLE'; end if;
	if not is_kmutt_email(v_email) or v_email !~ '^[^@\s]+@[^@\s]+$' then raise exception 'KMUTT_ONLY'; end if;
	if v_email = (select email from profiles where id = auth.uid()) then raise exception 'CANNOT_CHANGE_SELF'; end if;
	select role into v_old from team_members where email = v_email;
	insert into team_members (email, role, note, added_by) values (v_email, p_role, nullif(trim(coalesce(p_note, '')), ''), auth.uid())
	on conflict (email) do update set role = excluded.role;
	perform log_admin(case when v_old is null then 'MEMBER_ADDED' else 'MEMBER_ROLE_CHANGED' end, 'member', v_email, v_email,
		jsonb_build_object('role', p_role, 'was', v_old));
end $$;

create or replace function public.admin_remove_member(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_role text;
begin
	perform require_team(true);
	if v_email = (select email from profiles where id = auth.uid()) then raise exception 'CANNOT_CHANGE_SELF'; end if;
	select role into v_role from team_members where email = v_email;
	if v_role is null then raise exception 'NOT_A_MEMBER'; end if;
	if v_role = 'ADMIN' and (select count(*) from team_members where role = 'ADMIN') <= 1 then raise exception 'LAST_ADMIN'; end if;
	delete from team_members where email = v_email;
	perform log_admin('MEMBER_REMOVED', 'member', v_email, v_email, jsonb_build_object('role', v_role));
end $$;

create or replace function public.admin_activity(p_limit int default 100, p_before timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team(true);
	return (
		select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'at', l.created_at, 'by', l.actor_name, 'action', l.action,
			'target_type', l.target_type, 'target_id', l.target_id, 'target', l.target_label, 'detail', l.detail) order by l.created_at desc), '[]'::jsonb)
		from (select * from admin_log where p_before is null or created_at < p_before
			order by created_at desc limit greatest(1, least(p_limit, 500))) l
	);
end $$;

-- ---------- Grants: signed-in users may call; every function checks the team role itself ----------

revoke execute on function
	public.team_role(), public.require_team(boolean), public.log_admin(text, text, text, text, jsonb),
	public.order_attention(public.orders, int), public.order_row(public.orders)
from anon, authenticated, public;

grant execute on function
	public.team_me(), public.admin_orders(text, date, text, text, text, int, int), public.admin_order(uuid),
	public.admin_cancel_order(uuid, text), public.admin_confirm_payment(uuid, text), public.admin_unlock_otp(uuid),
	public.admin_requeue_order(uuid, text), public.admin_mark_refunded(uuid, text), public.admin_overview(date),
	public.admin_payouts(), public.admin_mark_payout(uuid, uuid[], text), public.admin_refunds_due(),
	public.admin_money_history(date, date), public.admin_stores(), public.admin_store_menu(text),
	public.admin_set_store_open(text, boolean), public.admin_set_item_available(text, boolean),
	public.admin_riders(), public.admin_add_rider(text, text), public.admin_remove_rider(text, text),
	public.admin_promotions(), public.admin_review_promo(uuid, boolean, text), public.admin_set_promo_active(uuid, boolean),
	public.admin_partners(), public.admin_invite_partner(text, text), public.admin_cancel_invite(text),
	public.admin_team(), public.admin_set_member(text, text, text), public.admin_remove_member(text),
	public.admin_activity(int, timestamptz)
to authenticated;
revoke execute on function
	public.team_me(), public.admin_orders(text, date, text, text, text, int, int), public.admin_order(uuid),
	public.admin_cancel_order(uuid, text), public.admin_confirm_payment(uuid, text), public.admin_unlock_otp(uuid),
	public.admin_requeue_order(uuid, text), public.admin_mark_refunded(uuid, text), public.admin_overview(date),
	public.admin_payouts(), public.admin_mark_payout(uuid, uuid[], text), public.admin_refunds_due(),
	public.admin_money_history(date, date), public.admin_stores(), public.admin_store_menu(text),
	public.admin_set_store_open(text, boolean), public.admin_set_item_available(text, boolean),
	public.admin_riders(), public.admin_add_rider(text, text), public.admin_remove_rider(text, text),
	public.admin_promotions(), public.admin_review_promo(uuid, boolean, text), public.admin_set_promo_active(uuid, boolean),
	public.admin_partners(), public.admin_invite_partner(text, text), public.admin_cancel_invite(text),
	public.admin_team(), public.admin_set_member(text, text, text), public.admin_remove_member(text),
	public.admin_activity(int, timestamptz)
from anon, public;
