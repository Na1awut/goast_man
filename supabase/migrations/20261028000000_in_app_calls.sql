-- ============================================================
-- In-app calls: buyer and rider talk through the app (WebRTC audio),
-- no phone numbers involved.
--
-- - Only while the order is in hand (ACCEPTED / DELIVERING), only between its
--   buyer and rider.
-- - calls keeps who rang whom, when, and for how long (evidence, like chat);
--   each call also leaves a line in the order's chat.
-- - The voice itself never touches the database: the two phones swap WebRTC
--   offers through a private Realtime channel "call:<order id>" that only the
--   order's two people may join, then talk peer to peer (or via TURN).
-- - A ringing call also goes out as a Web Push, so it rings with the app closed.
-- ============================================================

create table public.calls (
	id uuid primary key default gen_random_uuid(),
	order_id uuid not null references public.orders on delete cascade,
	caller_id uuid not null references auth.users on delete cascade,
	callee_id uuid not null references auth.users on delete cascade,
	caller_role text not null check (caller_role in ('CUSTOMER', 'RIDER')),
	status text not null default 'RINGING' check (status in ('RINGING', 'ACTIVE', 'ENDED', 'MISSED', 'DECLINED')),
	created_at timestamptz not null default now(),
	answered_at timestamptz,
	ended_at timestamptz
);
create index calls_order_idx on public.calls (order_id, created_at);
create index calls_callee_ringing_idx on public.calls (callee_id) where status = 'RINGING';
alter table public.calls enable row level security;
create policy "call participants read" on public.calls for select to authenticated
	using (auth.uid() in (caller_id, callee_id));
alter publication supabase_realtime add table public.calls;

/** A call can happen on this order right now, for the signed-in user */
create or replace function public.can_call(p_order_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
	select exists (
		select 1 from orders
		where id = p_order_id and status in ('ACCEPTED', 'DELIVERING') and rider_id is not null
			and auth.uid() in (customer_id, rider_id)
	)
$$;

-- Ring the other person on the order
create or replace function public.start_call(p_order_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
	o orders;
	v_role text;
	v_callee uuid;
	v_id uuid;
	v_name text;
begin
	if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
	select * into o from orders where id = p_order_id for update;
	if o.id is null or auth.uid() not in (o.customer_id, coalesce(o.rider_id, o.customer_id)) then raise exception 'ORDER_NOT_FOUND'; end if;
	if o.status not in ('ACCEPTED', 'DELIVERING') or o.rider_id is null then raise exception 'CALL_NOT_ALLOWED'; end if;
	v_role := case when auth.uid() = o.customer_id then 'CUSTOMER' else 'RIDER' end;
	v_callee := case when v_role = 'CUSTOMER' then o.rider_id else o.customer_id end;

	-- A ring nobody answered for a minute is over
	update calls set status = 'MISSED', ended_at = now()
	where order_id = p_order_id and status = 'RINGING' and created_at < now() - interval '60 seconds';
	if exists (select 1 from calls where order_id = p_order_id and status in ('RINGING', 'ACTIVE')) then
		raise exception 'CALL_BUSY';
	end if;

	insert into calls (order_id, caller_id, callee_id, caller_role)
	values (p_order_id, auth.uid(), v_callee, v_role) returning id into v_id;

	select coalesce(nullif(nickname, ''), 'เพื่อน') into v_name from profiles where id = auth.uid();
	perform queue_push(v_callee, 'สายเรียกเข้าจาก ' || v_name || case when v_role = 'CUSTOMER' then ' (ผู้ซื้อ)' else ' (คนหิ้ว)' end,
		'ออเดอร์ ' || o.order_code || ' · แตะเพื่อรับสาย', 'call-' || p_order_id);
	return v_id;
end $$;

create or replace function public.answer_call(p_call_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
	update calls set status = 'ACTIVE', answered_at = now()
	where id = p_call_id and callee_id = auth.uid() and status = 'RINGING' and created_at > now() - interval '60 seconds';
	if not found then raise exception 'CALL_GONE'; end if;
end $$;

-- Hang up, cancel or decline; leaves one line in the order's chat
create or replace function public.end_call(p_call_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
	c calls;
	v_status text;
	v_secs int;
	v_line text;
begin
	select * into c from calls where id = p_call_id and auth.uid() in (caller_id, callee_id) for update;
	if c.id is null then raise exception 'CALL_GONE'; end if;
	if c.status not in ('RINGING', 'ACTIVE') then return; end if;

	v_status := case
		when c.status = 'ACTIVE' then 'ENDED'
		when auth.uid() = c.callee_id then 'DECLINED'
		else 'MISSED' end;
	update calls set status = v_status, ended_at = now() where id = c.id;

	v_secs := extract(epoch from now() - c.answered_at)::int;
	v_line := case v_status
		when 'ENDED' then 'โทรผ่านแอป ' || (v_secs / 60) || ':' || lpad((v_secs % 60)::text, 2, '0') || ' นาที'
		when 'DECLINED' then 'ไม่ได้รับสาย (ปฏิเสธ)'
		else 'สายที่ไม่ได้รับ' end;
	insert into chat_messages (order_id, sender_role, body)
	values (c.order_id, 'SYSTEM', (case c.caller_role when 'CUSTOMER' then 'ผู้ซื้อ' else 'คนหิ้ว' end) || ' ' || v_line);
end $$;

-- A ring still waiting for me (the app opened from the push, or was already open)
create or replace function public.my_ringing_call() returns jsonb
language sql stable security definer set search_path = public as $$
	select to_jsonb(x) from (
		select c.id, c.order_id, c.caller_role, o.order_code,
			coalesce(nullif(p.nickname, ''), 'เพื่อน') as caller_name
		from calls c join orders o on o.id = c.order_id join profiles p on p.id = c.caller_id
		where c.callee_id = auth.uid() and c.status = 'RINGING' and c.created_at > now() - interval '60 seconds'
		order by c.created_at desc limit 1
	) x
$$;

-- The order ends: so does any call on it
create or replace function public.end_calls_with_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	if new.status in ('COMPLETED', 'CANCELLED', 'PENDING') and old.status <> new.status then
		update calls set status = case when status = 'ACTIVE' then 'ENDED' else 'MISSED' end, ended_at = now()
		where order_id = new.id and status in ('RINGING', 'ACTIVE');
	end if;
	return null;
end $$;
create trigger orders_end_calls after update of status on public.orders
	for each row execute function public.end_calls_with_order();

-- Signalling: the private Realtime channel "call:<order id>" is for the order's
-- two people while a call is allowed. Topics that don't parse are refused.
create or replace function public.can_join_call_topic(p_topic text) returns boolean
language sql stable security definer set search_path = public as $$
	select p_topic ~ '^call:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
		and can_call(substr(p_topic, 6)::uuid)
$$;

do $$ begin
	create policy "call signalling read" on realtime.messages for select to authenticated
		using (public.can_join_call_topic(realtime.topic()));
	create policy "call signalling send" on realtime.messages for insert to authenticated
		with check (public.can_join_call_topic(realtime.topic()));
exception when undefined_table or invalid_schema_name or undefined_function then
	raise notice 'Realtime authorization not available here';
end $$;

-- The team reads an order's calls next to its chat
create or replace function public.admin_order_calls(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(jsonb_build_object(
			'at', c.created_at, 'caller_role', c.caller_role, 'status', c.status,
			'seconds', case when c.answered_at is not null then extract(epoch from coalesce(c.ended_at, now()) - c.answered_at)::int end
		) order by c.created_at), '[]'::jsonb)
		from calls c where c.order_id = p_order_id
	);
end $$;

revoke execute on function public.can_call(uuid), public.start_call(uuid), public.answer_call(uuid), public.end_call(uuid),
	public.my_ringing_call(), public.can_join_call_topic(text), public.admin_order_calls(uuid), public.end_calls_with_order()
from anon, public;
grant execute on function public.can_call(uuid), public.start_call(uuid), public.answer_call(uuid), public.end_call(uuid),
	public.my_ringing_call(), public.can_join_call_topic(text), public.admin_order_calls(uuid)
to authenticated;
revoke execute on function public.end_calls_with_order() from authenticated;
