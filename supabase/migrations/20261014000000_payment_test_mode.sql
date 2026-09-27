-- ============================================================
-- QR payment test mode
--
-- For trying the whole PromptPay flow with friends without moving money. An
-- ADMIN switches it on and off from the console (ตั้งค่า). While it is on,
-- the buyer's PromptPay screen offers "จ่ายแบบทดสอบ": the order is marked
-- paid without a transfer or a slip, and goes to riders as usual.
--
-- Test payments are recorded like a slip with the reference "TEST:<order
-- code>", so the console and the books can always tell them apart. The switch
-- is logged, and the console shows a banner for as long as it is on.
-- ============================================================

-- Settings the team changes from the console (read and written through functions only)
create table public.app_settings (
	key text primary key,
	value jsonb not null,
	updated_at timestamptz not null default now(),
	updated_by text
);
alter table public.app_settings enable row level security;
insert into public.app_settings (key, value) values ('payment_test_mode', 'false') on conflict (key) do nothing;

create or replace function public.payment_test_mode() returns boolean
language sql stable security definer set search_path = public as $$
	select coalesce((select value = 'true'::jsonb from app_settings where key = 'payment_test_mode'), false)
$$;

-- What the apps need to know (buyers too, signed in or not)
create or replace function public.app_flags() returns jsonb
language sql stable security definer set search_path = public as $$
	select jsonb_build_object(
		'payment_test_mode', payment_test_mode(),
		'payment_test_since', (select updated_at from app_settings where key = 'payment_test_mode' and value = 'true'::jsonb),
		'payment_test_by', (select updated_by from app_settings where key = 'payment_test_mode' and value = 'true'::jsonb)
	)
$$;

create or replace function public.admin_set_payment_test_mode(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
	perform require_team(true);
	update app_settings set value = to_jsonb(coalesce(p_on, false)), updated_at = now(),
		updated_by = (select coalesce(nullif(nickname, ''), nullif(full_name, ''), email) from profiles where id = auth.uid())
	where key = 'payment_test_mode';
	perform log_admin(case when p_on then 'PAYMENT_TEST_ON' else 'PAYMENT_TEST_OFF' end, 'setting', 'payment_test_mode', 'โหมดทดสอบจ่าย QR');
end $$;

-- The buyer "pays" their own unpaid PromptPay order, only while test mode is on
create or replace function public.pay_order_test(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype;
begin
	if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
	if not payment_test_mode() then raise exception 'TEST_MODE_OFF'; end if;
	select * into v_order from orders where id = p_order_id and customer_id = auth.uid();
	if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
	-- Same checks and effects as a verified slip (amount, not paid twice, riders see it)
	perform record_slip_payment(p_order_id, 'TEST:' || v_order.order_code, v_order.total_price);
	insert into chat_messages (order_id, sender_role, body)
	values (p_order_id, 'SYSTEM', 'โหมดทดสอบ: ชำระแบบทดสอบ ไม่มีการโอนเงินจริง');
end $$;

revoke execute on function public.payment_test_mode() from anon, authenticated, public;
grant execute on function public.app_flags() to anon, authenticated;
grant execute on function public.admin_set_payment_test_mode(boolean), public.pay_order_test(uuid) to authenticated;
revoke execute on function public.admin_set_payment_test_mode(boolean), public.pay_order_test(uuid) from anon, public;
