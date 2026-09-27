-- ============================================================
-- Partner dashboard: a store owner sees their own sales and runs the basics
-- themselves, instead of asking the team.
--
-- - partner_dashboard(): today, the last 7 or 30 days, this month, best
--   sellers, orders on the way and the latest finished orders.
-- - partner_set_store_open() / partner_set_item_available(): open/close
--   taking app orders, and mark a dish sold out.
--
-- Sales are counted at menu price (food_total) on completed orders: that is
-- what the rider pays at the counter. Delivery fee and tip are the rider's,
-- not the store's. Store promotion discounts are shown separately.
-- The store never sees buyers' names or phone numbers: only order codes,
-- dishes and the nickname of the rider who comes to collect.
-- Store actions go to admin_log too, so the team sees who closed a store.
-- ============================================================

-- The signed-in partner's store, or null
create or replace function public.partner_store() returns text
language sql stable security definer set search_path = public as $$
	select partner_store_id from profiles where id = auth.uid() and role = 'PARTNER'
$$;

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
				'sales', (select coalesce(sum(food_total), 0) from done where done_day = v_today),
				'orders', (select count(*) from done where done_day = v_today),
				'items', (select coalesce(sum(i.quantity), 0) from done d join order_items i on i.order_id = d.id where d.done_day = v_today),
				'discounts', (select coalesce(sum(partner_discount), 0) from done where done_day = v_today),
				'cancelled', (select count(*) from mine where status = 'CANCELLED' and day = v_today),
				'on_the_way', (select count(*) from mine where status in ('ACCEPTED', 'DELIVERING')
					or (status = 'PENDING' and (payment_method = 'CASH' or paid_at is not null)))
			),
			'month', jsonb_build_object(
				'sales', (select coalesce(sum(food_total), 0) from done where date_trunc('month', done_day) = date_trunc('month', v_today)),
				'orders', (select count(*) from done where date_trunc('month', done_day) = date_trunc('month', v_today))
			),
			'days', (
				select jsonb_agg(jsonb_build_object(
					'day', g::date,
					'sales', (select coalesce(sum(food_total), 0) from done where done_day = g::date),
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
					select m.id, m.order_code as code, m.status, m.created_at, m.accepted_at, m.note, m.food_total,
						(select coalesce(nullif(p.nickname, ''), 'คนหิ้ว') from profiles p where p.id = m.rider_id) as rider,
						(select jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity)) from order_items i where i.order_id = m.id) as items
					from mine m
					where m.status in ('ACCEPTED', 'DELIVERING')
						or (m.status = 'PENDING' and (m.payment_method = 'CASH' or m.paid_at is not null))
				) x
			),
			'recent', (
				select coalesce(jsonb_agg(x order by x.completed_at desc), '[]'::jsonb) from (
					select d.id, d.order_code as code, d.completed_at, d.food_total, d.partner_discount,
						(select string_agg(i.name || ' ×' || i.quantity, ', ') from order_items i where i.order_id = d.id) as items
					from done d order by d.completed_at desc limit 20
				) x
			)
		)
	);
end $$;

create or replace function public.partner_set_store_open(p_open boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_store text := partner_store(); v_name text;
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	update stores set is_open = coalesce(p_open, false) where id = v_store returning name into v_name;
	perform log_admin(case when p_open then 'STORE_OPENED' else 'STORE_CLOSED' end, 'store', v_store, v_name, '{"by": "partner"}');
end $$;

create or replace function public.partner_set_item_available(p_item_id text, p_available boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_store text := partner_store(); v_item text; v_name text;
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	update menu_items set is_available = coalesce(p_available, false)
	where id = p_item_id and store_id = v_store returning name into v_item;
	if v_item is null then raise exception 'ITEM_NOT_FOUND'; end if;
	select name into v_name from stores where id = v_store;
	perform log_admin(case when p_available then 'ITEM_ON' else 'ITEM_OFF' end, 'store', v_store, v_name,
		jsonb_build_object('item_id', p_item_id, 'item', v_item, 'by', 'partner'));
end $$;

revoke execute on function public.partner_store() from anon, authenticated, public;
grant execute on function public.partner_dashboard(int), public.partner_set_store_open(boolean), public.partner_set_item_available(text, boolean) to authenticated;
revoke execute on function public.partner_dashboard(int), public.partner_set_store_open(boolean), public.partner_set_item_available(text, boolean) from anon, public;
