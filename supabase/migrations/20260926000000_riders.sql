-- ============================================================
-- Riders (คนหิ้ว)
--
-- Phase 1: only our own team runs errands. They are listed by email in
-- rider_roster, managed from the SQL Editor. Every rider check in the
-- database goes through is_rider(), so opening riding to every student
-- later is a one-line change to that function (see supabase/README.md).
--
-- A rider carries at most rider_capacity() jobs per outing and takes no
-- new job once they have started delivering, the same rules the route
-- planner (frontend/src/lib/routing) assumes.
-- ============================================================

create table public.rider_roster (
	email text primary key check (email = lower(email)),
	note text,
	added_at timestamptz not null default now()
);
alter table public.rider_roster enable row level security; -- no policies: SQL Editor only

create or replace function public.is_rider() returns boolean
language sql stable security definer set search_path = public as $$
	select exists (
		select 1 from profiles p join rider_roster r on r.email = p.email
		where p.id = auth.uid() and p.role = 'STUDENT'
	)
$$;

create or replace function public.rider_capacity() returns int language sql immutable as $$ select 4 $$;

create or replace function public.accept_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
	if not is_rider() then raise exception 'RIDER_ONLY'; end if;
	-- One rider's accepts run one at a time, so two quick taps cannot exceed capacity
	perform pg_advisory_xact_lock(hashtext('rider:' || auth.uid()::text));
	if exists (select 1 from orders where rider_id = auth.uid() and status = 'DELIVERING') then
		raise exception 'FINISH_ROUND_FIRST';
	end if;
	if (select count(*) from orders where rider_id = auth.uid() and status = 'ACCEPTED') >= rider_capacity() then
		raise exception 'RIDER_FULL';
	end if;
	-- Single conditional UPDATE: two riders tapping at once cannot both win
	update orders set status = 'ACCEPTED', rider_id = auth.uid(), accepted_at = now()
	where id = p_order_id and status = 'PENDING' and customer_id <> auth.uid();
	if not found then raise exception 'ALREADY_TAKEN'; end if;
end $$;

-- Hand a job back before collecting it, so it never gets stuck with an unavailable rider
create or replace function public.release_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
	update orders set status = 'PENDING', rider_id = null, accepted_at = null
	where id = p_order_id and rider_id = auth.uid() and status = 'ACCEPTED';
	if not found then raise exception 'BAD_STATE'; end if;
end $$;

-- The buyer's chat also says when a job goes back to the queue
create or replace function public.log_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_text text;
begin
	if new.status is distinct from old.status then
		v_text := case new.status
			when 'PENDING' then 'คนหิ้วคืนงาน กำลังหาเพื่อนคนใหม่'
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

-- Everything the rider screen needs in one round trip: open jobs, and the
-- rider's own round with the customer's contact details. null for non-riders.
create or replace function public.rider_board() returns jsonb
language sql stable security definer set search_path = public as $$
	select case when not is_rider() then null else jsonb_build_object(
		'capacity', rider_capacity(),
		'open', (
			select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at), '[]'::jsonb)
			from (
				select o.id, o.order_code, o.kind, o.store_id, o.pickup_name, o.dropoff_name, o.item_details,
					o.food_total, o.delivery_fee, o.total_price, o.payment_method, o.status, o.note, o.created_at,
					(select jsonb_agg(jsonb_build_object('name', i.name, 'price', i.price, 'quantity', i.quantity))
						from order_items i where i.order_id = o.id) as items
				from orders o
				where o.status = 'PENDING' and o.customer_id <> auth.uid()
			) j
		),
		'mine', (
			select coalesce(jsonb_agg(to_jsonb(j) order by j.accepted_at), '[]'::jsonb)
			from (
				select o.id, o.order_code, o.kind, o.store_id, o.pickup_name, o.dropoff_name, o.item_details,
					o.food_total, o.delivery_fee, o.total_price, o.payment_method, o.status, o.note, o.created_at,
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

-- Open jobs are visible to riders only (was: every student). Realtime uses
-- these policies too, so only riders get new-job events.
drop policy "participants read orders" on public.orders;
create policy "participants read orders" on public.orders for select
	using (auth.uid() in (customer_id, rider_id) or (status = 'PENDING' and public.is_rider()));
drop policy "participants read items" on public.order_items;
create policy "participants read items" on public.order_items for select
	using (exists (select 1 from public.orders o where o.id = order_id
		and (auth.uid() in (o.customer_id, o.rider_id) or (o.status = 'PENDING' and public.is_rider()))));

revoke execute on function public.is_rider(), public.rider_capacity(), public.release_order(uuid), public.rider_board() from anon, public;
grant execute on function public.is_rider(), public.rider_capacity(), public.release_order(uuid), public.rider_board() to authenticated;
