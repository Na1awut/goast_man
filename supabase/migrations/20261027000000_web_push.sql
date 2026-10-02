-- ============================================================
-- Web Push: notifications that arrive with the app closed
--
-- The browser hands each device a push subscription; the app saves it here.
-- Order and chat events queue a row in push_outbox, and the row's insert
-- calls the send-push Edge Function through pg_net, which delivers it to the
-- user's devices with the VAPID key (kept in Edge Function secrets).
--
-- Setup (once): node supabase/functions/send-push/setup.mjs mailto:<team email>
--   Vault secrets  push_hook_url    = https://<ref>.supabase.co/functions/v1/send-push
--                  push_hook_secret = the same random value as the function's PUSH_HOOK_SECRET
-- Until both exist the outbox still fills, nothing is sent, and nothing fails.
-- ============================================================

do $$ begin
	create extension if not exists pg_net;
exception when others then
	raise notice 'pg_net not available: push stays queued only';
end $$;

-- ---------- Subscriptions ----------

create table public.push_subscriptions (
	endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
	user_id uuid not null references auth.users on delete cascade,
	p256dh text not null check (char_length(p256dh) between 1 and 200),
	auth text not null check (char_length(auth) between 1 and 100),
	created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security; -- no policies: functions only

-- This device now belongs to the signed-in user (a shared phone moves with whoever signs in)
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
	if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
	insert into push_subscriptions (endpoint, user_id, p256dh, auth)
	values (p_endpoint, auth.uid(), p_p256dh, p_auth)
	on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $$;

create or replace function public.remove_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
	delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;

-- ---------- Outbox ----------

create table public.push_outbox (
	id bigint generated always as identity primary key,
	user_id uuid not null references auth.users on delete cascade,
	title text not null,
	body text not null default '',
	url text not null default '/',
	-- Same tag replaces the older notification on the device (one per order / chat)
	tag text,
	created_at timestamptz not null default now(),
	sent_at timestamptz,
	error text
);
create index push_outbox_created_idx on public.push_outbox (created_at);
alter table public.push_outbox enable row level security; -- no policies: functions only

-- Queue a notification, only for someone with a device to send it to
create or replace function public.queue_push(p_user uuid, p_title text, p_body text, p_tag text, p_url text default '/') returns void
language plpgsql security definer set search_path = public as $$
begin
	if p_user is null or not exists (select 1 from push_subscriptions where user_id = p_user) then return; end if;
	insert into push_outbox (user_id, title, body, tag, url)
	values (p_user, left(p_title, 80), left(coalesce(p_body, ''), 160), p_tag, p_url);
end $$;

-- Hand the row to send-push. Best effort: a missing setup or a network error
-- never blocks the order or chat that queued it.
create or replace function public.push_dispatch() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
	begin
		select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_hook_url';
		select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_hook_secret';
		if v_url is not null and v_secret is not null then
			perform net.http_post(
				url := v_url,
				body := jsonb_build_object('id', new.id),
				headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret)
			);
		end if;
	exception when others then
		update push_outbox set error = left(sqlerrm, 200) where id = new.id;
	end;
	return null;
end $$;
create trigger push_outbox_dispatch after insert on public.push_outbox
	for each row execute function public.push_dispatch();

-- ---------- What gets a notification ----------

create or replace function public.push_on_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
	v_rider text := (select coalesce(nullif(nickname, ''), 'คนหิ้ว') from profiles where id = new.rider_id);
	v_open_now boolean := new.status = 'PENDING' and (new.payment_method = 'CASH' or new.paid_at is not null);
	v_open_before boolean := tg_op = 'UPDATE' and old.status = 'PENDING' and (old.payment_method = 'CASH' or old.paid_at is not null);
	r record;
begin
	-- A new job on the board: every rider switched on, except the buyer themself
	if v_open_now and not v_open_before then
		for r in select rp.rider_id as id from rider_presence rp where rp.online and rp.rider_id <> new.customer_id and rider_is_ready(rp.rider_id) loop
			perform queue_push(r.id, 'มีงานใหม่ ' || new.pickup_name,
				'ส่งที่ ' || new.dropoff_name || ' · ค่าหิ้ว ' || new.delivery_fee || ' ฿', 'job-' || new.id, '/');
		end loop;
	end if;

	if tg_op <> 'UPDATE' or new.status = old.status then return null; end if;

	if new.status = 'ACCEPTED' and old.status = 'PENDING' then
		perform queue_push(new.customer_id, v_rider || ' รับงานหิ้วแล้ว',
			'กำลังไปที่ ' || new.pickup_name || ' · ออเดอร์ ' || new.order_code, 'order-' || new.id);
	elsif new.status = 'DELIVERING' then
		perform queue_push(new.customer_id, v_rider || ' ซื้อของครบแล้ว กำลังไปส่ง',
			'เตรียมรหัส OTP ไว้ได้เลย · ' || new.dropoff_name, 'order-' || new.id);
	elsif new.status = 'PENDING' and old.status = 'ACCEPTED' and old.rider_id is not null then
		-- The team handed the job back to the queue
		perform queue_push(old.rider_id, 'ทีมคืนงาน ' || new.order_code || ' เข้าคิวแล้ว', 'งานนี้ไม่อยู่ในรอบของคุณแล้ว', 'order-' || new.id);
	elsif new.status = 'CANCELLED' then
		if new.customer_id is distinct from auth.uid() then
			perform queue_push(new.customer_id, 'ออเดอร์ ' || new.order_code || ' ถูกยกเลิก',
				coalesce(nullif(new.cancel_reason, ''), 'เปิดแอปเพื่อดูรายละเอียด'), 'order-' || new.id);
		end if;
		if old.rider_id is not null and old.rider_id is distinct from auth.uid() then
			perform queue_push(old.rider_id, 'งาน ' || new.order_code || ' ถูกยกเลิก',
				'ไม่ต้องไปส่งงานนี้แล้ว', 'order-' || new.id);
		end if;
	end if;
	return null;
end $$;
create trigger orders_push after insert or update on public.orders
	for each row execute function public.push_on_order();

create or replace function public.push_on_chat() returns trigger
language plpgsql security definer set search_path = public as $$
declare
	o orders;
	v_from text := (select coalesce(nullif(nickname, ''), 'เพื่อน') from profiles where id = new.sender_id);
	v_text text := case when new.body <> '' then new.body else 'ส่งรูปภาพ' end;
begin
	select * into o from orders where id = new.order_id;
	if new.sender_role = 'CUSTOMER' then
		perform queue_push(o.rider_id, 'ข้อความจาก ' || v_from || ' (ผู้ซื้อ)', v_text, 'chat-' || o.id);
	elsif new.sender_role = 'RIDER' then
		perform queue_push(o.customer_id, 'ข้อความจาก ' || v_from || ' (คนหิ้ว)', v_text, 'chat-' || o.id);
	end if;
	return null;
end $$;
create trigger chat_messages_push after insert on public.chat_messages
	for each row execute function public.push_on_chat();

-- The outbox is a delivery log, not a record: keep a week
do $$ begin
	perform cron.schedule('push-outbox-cleanup', '20 4 * * *', $c$delete from public.push_outbox where created_at < now() - interval '7 days'$c$);
exception when others then
	raise notice 'pg_cron not available: push_outbox is not cleaned up automatically';
end $$;

revoke execute on function public.queue_push(uuid, text, text, text, text), public.push_dispatch(),
	public.push_on_order(), public.push_on_chat() from anon, authenticated, public;
revoke execute on function public.save_push_subscription(text, text, text), public.remove_push_subscription(text) from anon, public;
grant execute on function public.save_push_subscription(text, text, text), public.remove_push_subscription(text) to authenticated;
