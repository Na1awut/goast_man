-- ============================================================
-- Recycle bin for stores
--
-- An ADMIN deletes a store from the console. It disappears at once, from the
-- app and from the team's store list, and waits in the recycle bin:
-- - an ADMIN can restore it within 60 days (it comes back hidden and closed,
--   so the team checks it before showing it again),
-- - after 60 days it is erased for good, with its menu, promotions and invite.
--   Past orders stay (they keep the store's name and the dishes' names and prices).
-- An ADMIN can also erase a store in the bin straight away.
--
-- Erasing runs every night (pg_cron) and also whenever the bin is opened.
-- Photos the team uploaded stay in storage; a new store never reuses an
-- erased store's id, so they never show up again.
-- ============================================================

alter table public.stores add column deleted_at timestamptz, add column deleted_by text;

-- Days a deleted store waits in the bin
create or replace function public.store_bin_days() returns int language sql immutable as $$ select 60 $$;

-- Deleted stores are gone for everyone, the team included (the bin has its own function).
-- A hidden store is seen by the team and by its own owner (their partner app).
drop policy "stores are public" on public.stores;
create policy "stores are public" on public.stores for select
	using (deleted_at is null and (not hidden or public.is_team() or owner_id = auth.uid()));

-- The owner of a deleted store no longer runs it (back when it is restored)
create or replace function public.partner_store() returns text
language sql stable security definer set search_path = public as $$
	select p.partner_store_id from profiles p
	join stores s on s.id = p.partner_store_id and s.deleted_at is null
	where p.id = auth.uid() and p.role = 'PARTNER'
$$;

-- A store in the bin cannot be changed: only restored, or erased
create or replace function public.keep_deleted_store_shut() returns trigger
language plpgsql as $$
begin
	-- The owner account going away, or a rating on an old order, still go through
	if old.deleted_at is not null and new.deleted_at is not null
		and (to_jsonb(new) - '{owner_id,is_partner,rating,reviews_count}'::text[])
			is distinct from (to_jsonb(old) - '{owner_id,is_partner,rating,reviews_count}'::text[]) then
		raise exception 'STORE_DELETED';
	end if;
	return new;
end $$;
create trigger stores_keep_deleted_shut before update on public.stores
	for each row execute function public.keep_deleted_store_shut();

-- ...nor its menu, promotions or invite
create or replace function public.refuse_deleted_store() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	if exists (select 1 from stores where id = new.store_id and deleted_at is not null) then
		raise exception 'STORE_DELETED';
	end if;
	return new;
end $$;
create trigger menu_items_refuse_deleted_store before insert or update on public.menu_items
	for each row execute function public.refuse_deleted_store();
create trigger promotions_refuse_deleted_store before insert or update on public.promotions
	for each row execute function public.refuse_deleted_store();
create trigger partner_invites_refuse_deleted_store before insert or update on public.partner_invites
	for each row execute function public.refuse_deleted_store();

-- Past orders keep the dish's name and price on the order line, so erasing a
-- store may take its menu rows with it
alter table public.order_items drop constraint order_items_menu_item_id_fkey;

-- ---------- Delete, restore, erase ----------

create or replace function public.admin_delete_store(p_store_id text) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
	perform require_team(true);
	select name into v_name from stores where id = p_store_id and deleted_at is null;
	if v_name is null then raise exception 'STORE_NOT_FOUND'; end if;
	if exists (select 1 from orders where store_id = p_store_id and status in ('PENDING', 'ACCEPTED', 'DELIVERING')) then
		raise exception 'STORE_HAS_ACTIVE_ORDERS';
	end if;
	update stores set deleted_at = now(), hidden = true, is_open = false,
		deleted_by = (select coalesce(nullif(nickname, ''), nullif(full_name, ''), email) from profiles where id = auth.uid())
	where id = p_store_id;
	perform log_admin('STORE_DELETED', 'store', p_store_id, v_name);
end $$;

-- Erase one store that is in the bin (internal)
create or replace function public.purge_store(p_store_id text, p_why text) returns void
language plpgsql security definer set search_path = public as $$
declare v_store stores%rowtype;
begin
	select * into v_store from stores where id = p_store_id and deleted_at is not null;
	if v_store.id is null then raise exception 'STORE_NOT_FOUND'; end if;
	delete from stores where id = p_store_id;
	perform log_admin('STORE_PURGED', 'store', p_store_id, v_store.name,
		jsonb_build_object('why', p_why, 'deleted_at', v_store.deleted_at, 'deleted_by', v_store.deleted_by));
end $$;

-- Erase every store that has been in the bin for 60 days; returns how many
create or replace function public.purge_expired_stores() returns int
language plpgsql security definer set search_path = public as $$
declare v_id text; v_count int := 0;
begin
	for v_id in select id from stores where deleted_at < now() - make_interval(days => store_bin_days()) loop
		perform purge_store(v_id, 'expired');
		v_count := v_count + 1;
	end loop;
	return v_count;
end $$;

-- Back from the bin, still hidden and closed until the team shows it
create or replace function public.admin_restore_store(p_store_id text) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
	perform require_team(true);
	perform purge_expired_stores();
	update stores set deleted_at = null, deleted_by = null
	where id = p_store_id and deleted_at is not null returning name into v_name;
	if v_name is null then raise exception 'STORE_NOT_FOUND'; end if;
	perform log_admin('STORE_RESTORED', 'store', p_store_id, v_name);
end $$;

create or replace function public.admin_purge_store(p_store_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
	perform require_team(true);
	perform purge_store(p_store_id, 'admin');
end $$;

-- The bin: newest first, with the day each store is erased
create or replace function public.admin_trash() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
	perform require_team(true);
	perform purge_expired_stores();
	return (
		select coalesce(jsonb_agg(jsonb_build_object(
			'id', s.id, 'name', s.name, 'category', s.category, 'lock', s.lock, 'image_url', s.image_url, 'logo_url', s.logo_url,
			'deleted_at', s.deleted_at, 'deleted_by', s.deleted_by,
			'purge_at', s.deleted_at + make_interval(days => store_bin_days()),
			'owner_email', (select p.email from profiles p where p.id = s.owner_id),
			'items_total', (select count(*) from menu_items m where m.store_id = s.id and not m.archived),
			'orders_total', (select count(*) from orders o where o.store_id = s.id)
		) order by s.deleted_at desc), '[]'::jsonb)
		from stores s where s.deleted_at is not null
	);
end $$;

-- ---------- The console's lists leave deleted stores out ----------

create or replace function public.admin_stores() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(jsonb_build_object(
			'id', s.id, 'name', s.name, 'category', s.category, 'lock', s.lock, 'image_url', s.image_url, 'logo_url', s.logo_url,
			'is_open', s.is_open, 'is_partner', s.is_partner, 'zone', s.zone, 'hidden', s.hidden,
			'owner_email', (select p.email from profiles p where p.id = s.owner_id),
			'invite_email', (select i.email from partner_invites i where i.store_id = s.id limit 1),
			'orders_today', (select count(*) from orders o where o.store_id = s.id and bkk(o.created_at)::date = bkk_today()),
			'items_total', (select count(*) from menu_items m where m.store_id = s.id and not m.archived),
			'items_off', (select count(*) from menu_items m where m.store_id = s.id and not m.archived and not m.is_available)
		) order by s.hidden, s.lock, s.name), '[]'::jsonb)
		from stores s where s.deleted_at is null
	);
end $$;

-- A new store never takes the id of one that was erased (its old photos and log stay apart)
create or replace function public.admin_create_store(
	p_name text, p_category text, p_zone text, p_lock text, p_description text, p_queue_minutes int
) returns text
language plpgsql security definer set search_path = public as $$
declare
	v_zone store_zone;
	v_prefix text;
	v_next int;
	v_id text;
begin
	perform require_team();
	begin
		v_zone := p_zone::store_zone;
	exception when others then
		raise exception 'BAD_ZONE';
	end;
	-- Ids follow the existing pattern: kfc-13 in the KFC canteen, <zone>-NN elsewhere
	v_prefix := case when v_zone = 'kfc-main' then 'kfc' else v_zone::text end;
	select coalesce(max((regexp_match(x.id, '^' || v_prefix || '-(\d+)$'))[1]::int), 0) + 1 into v_next
	from (select id from stores union all select target_id from admin_log where action = 'STORE_PURGED') x
	where x.id ~ ('^' || v_prefix || '-\d+$');
	v_id := v_prefix || '-' || lpad(v_next::text, 2, '0');
	insert into stores (id, zone, name, category, description, image_url, lock, is_open, hidden)
	values (v_id, v_zone, 'ร้านใหม่', 'ร้านอาหาร', '', '', trim(coalesce(p_lock, '')), false, true);
	perform store_update_info(v_id, 'team', p_name, p_category, p_description, coalesce(p_queue_minutes, 10));
	perform log_admin('STORE_CREATED', 'store', v_id, trim(p_name), jsonb_build_object('zone', v_zone));
	return v_id;
end $$;

-- Overview: "stores open x of y" counts the stores customers can see
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
			'stores_total', (select count(*) from stores where deleted_at is null and not hidden),
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

revoke execute on function
	public.purge_store(text, text),
	public.purge_expired_stores()
from anon, authenticated, public;
grant execute on function
	public.admin_delete_store(text),
	public.admin_restore_store(text),
	public.admin_purge_store(text),
	public.admin_trash()
to authenticated;
revoke execute on function
	public.admin_delete_store(text),
	public.admin_restore_store(text),
	public.admin_purge_store(text),
	public.admin_trash()
from anon, public;

-- Every night at 03:00 Bangkok, erase what has been in the bin for 60 days
-- (skipped where pg_cron is not available, e.g. the local test database)
do $cron$
begin
	if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
		execute 'create extension if not exists pg_cron';
		execute $job$select cron.schedule('purge-deleted-stores', '0 20 * * *', 'select public.purge_expired_stores()')$job$;
	end if;
end $cron$;
