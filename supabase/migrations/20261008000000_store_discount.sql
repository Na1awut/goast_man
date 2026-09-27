-- ============================================================
-- Who pays a discount, and no more joint promotions
--
-- Two kinds of discount only:
-- - A store's own deal (promotion kind DEAL): the store's money. The stall
--   charges the discounted price, so the rider pays it less at the counter.
--   A deal can only take money off the food, never the delivery fee.
-- - The app's promo codes (KMUTTFIRST, GOOSEFREE, valid at every store):
--   Goose Man's money. The stall gets its full menu price and the team makes
--   up the difference to the rider.
-- Joint promotions (CO_PROMO) are dropped: existing ones are switched off
-- and stores can no longer create them.
--
-- orders.store_discount records, at the time of ordering, the part of the
-- discount the store gives. Everything that counts money uses it:
--   paid at the counter  = food_total - store_discount
--   owed to the rider    = food_total - store_discount + delivery_fee + tip
--                          - (cash collected at the door)
--   the store's sales    = food_total - store_discount
-- ============================================================

alter table public.orders add column store_discount int not null default 0 check (store_discount >= 0);

-- Set when the order is placed, from the promotion that applied. Stored, so a
-- deal later turned into a joint promotion does not rewrite old orders.
create or replace function public.stamp_store_discount() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	new.store_discount := case
		when new.promotion_id is not null and (select kind from promotions where id = new.promotion_id) = 'DEAL' then new.partner_discount
		else 0
	end;
	return new;
end $$;
create trigger orders_stamp_store_discount before insert on public.orders
	for each row execute function public.stamp_store_discount();

-- Orders placed so far
update public.orders o set store_discount = o.partner_discount
from public.promotions p where p.id = o.promotion_id and p.kind = 'DEAL';

-- Joint promotions are gone: switch off any that exist
update public.promotions set active = false where kind = 'CO_PROMO';

-- Stores make their own deals only: live at once, a discount on the food, no free delivery
create or replace function public.guard_promotion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	-- No signed-in user = SQL editor, seed or service role: trust as admin
	if auth.uid() is null or public.team_role() = 'ADMIN' then
		return new;
	end if;
	if new.kind <> 'DEAL' then raise exception 'STORE_DEALS_ONLY'; end if;
	if new.free_delivery then raise exception 'FREE_DELIVERY_NEEDS_TEAM'; end if;
	new.approved := true;
	return new;
end $$;

-- What the team owes the rider for a finished order (mirrors owedToRider in the app)
create or replace function public.rider_owed(o public.orders) returns int
language sql immutable as $$
	select o.food_total - o.store_discount + o.delivery_fee + case when o.tip_in_total then o.tip else 0 end
		- case when o.payment_method = 'CASH' then o.total_price else 0 end
$$;

-- The rider's board says how much to pay at the counter
create or replace function public.rider_board() returns jsonb
language sql stable security definer set search_path = public as $$
	select case when not is_rider() then null else jsonb_build_object(
		'capacity', rider_capacity(),
		'online', rider_is_ready(auth.uid()),
		'open', (
			select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at), '[]'::jsonb)
			from (
				select o.id, o.order_code, o.kind, o.store_id, o.pickup_name, o.dropoff_name, o.item_details,
					o.food_total, o.delivery_fee, o.tip, o.store_discount, o.total_price, o.payment_method, o.status, o.note, o.created_at,
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
					o.food_total, o.delivery_fee, o.tip, o.store_discount, o.total_price, o.payment_method, o.status, o.note, o.created_at,
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

-- The store's numbers are what it actually receives
create or replace function public.partner_dashboard(p_days int default 7) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
	v_store text := partner_store();
	v_days int := case when p_days = 30 then 30 else 7 end;
	v_today date := bkk_today();
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	return (
		with mine as (
			select o.*, bkk(o.created_at)::date as day, bkk(coalesce(o.completed_at, o.created_at))::date as done_day
			from orders o where o.store_id = v_store
		),
		done as (select * from mine where status = 'COMPLETED')
		select jsonb_build_object(
			'store_id', v_store,
			'is_open', (select is_open from stores where id = v_store),
			'today', jsonb_build_object(
				'sales', (select coalesce(sum(food_total - store_discount), 0) from done where done_day = v_today),
				'orders', (select count(*) from done where done_day = v_today),
				'items', (select coalesce(sum(i.quantity), 0) from done d join order_items i on i.order_id = d.id where d.done_day = v_today),
				'discounts', (select coalesce(sum(store_discount), 0) from done where done_day = v_today),
				'cancelled', (select count(*) from mine where status = 'CANCELLED' and day = v_today),
				'on_the_way', (select count(*) from mine where status in ('ACCEPTED', 'DELIVERING')
					or (status = 'PENDING' and (payment_method = 'CASH' or paid_at is not null)))
			),
			'month', jsonb_build_object(
				'sales', (select coalesce(sum(food_total - store_discount), 0) from done where date_trunc('month', done_day) = date_trunc('month', v_today)),
				'orders', (select count(*) from done where date_trunc('month', done_day) = date_trunc('month', v_today))
			),
			'days', (
				select jsonb_agg(jsonb_build_object(
					'day', g::date,
					'sales', (select coalesce(sum(food_total - store_discount), 0) from done where done_day = g::date),
					'orders', (select count(*) from done where done_day = g::date)
				) order by g)
				from generate_series(v_today - (v_days - 1), v_today, interval '1 day') g
			),
			'top_items', (
				select coalesce(jsonb_agg(t order by t.qty desc, t.sales desc), '[]'::jsonb) from (
					select i.name, sum(i.quantity) as qty, sum(i.price * i.quantity) as sales
					from done d join order_items i on i.order_id = d.id
					where d.done_day > v_today - 30
					group by i.name order by qty desc, sales desc limit 5
				) t
			),
			-- Orders the stall should expect: not yet collected, or on their way
			'live', (
				select coalesce(jsonb_agg(x order by x.created_at), '[]'::jsonb) from (
					select m.id, m.order_code as code, m.status, m.created_at, m.accepted_at, m.note, m.food_total - m.store_discount as food_total,
						(select coalesce(nullif(p.nickname, ''), 'คนหิ้ว') from profiles p where p.id = m.rider_id) as rider,
						(select jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity)) from order_items i where i.order_id = m.id) as items
					from mine m
					where m.status in ('ACCEPTED', 'DELIVERING')
						or (m.status = 'PENDING' and (m.payment_method = 'CASH' or m.paid_at is not null))
				) x
			),
			'recent', (
				select coalesce(jsonb_agg(x order by x.completed_at desc), '[]'::jsonb) from (
					select d.id, d.order_code as code, d.completed_at, d.food_total - d.store_discount as food_total, d.store_discount as partner_discount,
						(select string_agg(i.name || ' ×' || i.quantity, ', ') from order_items i where i.order_id = d.id) as items
					from done d order by d.completed_at desc limit 20
				) x
			)
		)
	);
end $$;

-- The team's day: rider cost uses the same formula as the payouts
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
			'rider_cost_day', (select coalesce(sum(rider_owed(o)), 0)
				from orders o where o.status = 'COMPLETED' and bkk(o.completed_at)::date = v_day),
			'payouts_due', (select coalesce(sum(owed), 0) from due),
			'payouts_due_riders', (select count(distinct rider_id) from due),
			'avg_accept_minutes', (select round(avg(extract(epoch from accepted_at - coalesce(paid_at, created_at)) / 60)::numeric, 1)
				from dayrows where accepted_at is not null),
			'problems', (select count(*) from problems),
			'pending_promos', (select count(*) from promotions where kind = 'CO_PROMO' and not approved and active
				and (ends_at is null or ends_at > now())),
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

-- Order detail shows which part of the discount the store gave
create or replace function public.admin_order(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o orders%rowtype;
begin
	perform require_team();
	select * into o from orders where id = p_order_id;
	if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
	return order_row(o) || jsonb_build_object(
		'note', o.note, 'food_total', o.food_total, 'delivery_fee', o.delivery_fee,
		'code_discount', o.code_discount, 'partner_discount', o.partner_discount, 'store_discount', o.store_discount, 'promo_code', o.promo_code,
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

revoke execute on function public.stamp_store_discount() from anon, authenticated, public;
