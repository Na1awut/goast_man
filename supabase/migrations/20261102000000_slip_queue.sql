-- ============================================================
-- Slip check as a queue, and the money gaps found in the order/payment review
--
-- Before: the buyer's request waited for SlipOK, and a slip SlipOK had accepted
-- but the database had not recorded (buyer cancelled meanwhile, network dropped)
-- left real money received with no trace.
--
-- Now: the slip image is stored, a row is queued and the buyer is told at once
-- ("สร้างออเดอร์แล้ว กำลังตรวจสลิป"). verify-slip checks queued slips a few at a
-- time. Nothing SlipOK accepted is ever lost:
--   * a slip that arrives for a cancelled order is recorded as paid, so the
--     order shows up in the refund list
--   * a slip SlipOK accepted but we could not record, or one stuck mid-check,
--     goes to NEEDS_REVIEW with its image, and the order is flagged for the team
-- Also here: attempts per order and per buyer are capped (SlipOK is paid per
-- check), unpaid PromptPay orders are capped and expire, and STAFF can confirm
-- a payment by hand only when the buyer actually uploaded a slip.
-- ============================================================

-- ---------- Slip images: private, images only, 5 MB ----------
insert into storage.buckets (id, name, public) values ('payment-slips', 'payment-slips', false)
on conflict (id) do nothing;
do $$ begin
	update storage.buckets set file_size_limit = 5242880,
		allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
	where id = 'payment-slips';
exception when undefined_column then
	raise notice 'storage.buckets has no size/type columns here';
end $$;
-- no storage policies on purpose: only the verify-slip function (service role) reads or writes slips

-- ---------- The queue ----------
create table public.slip_submissions (
	id uuid primary key default gen_random_uuid(),
	order_id uuid not null references public.orders on delete cascade,
	customer_id uuid not null references auth.users on delete cascade,
	image_path text not null,
	status text not null default 'QUEUED' check (status in ('QUEUED', 'CHECKING', 'PAID', 'REJECTED', 'NEEDS_REVIEW')),
	error_code text,
	-- SlipOK transRef, kept whenever SlipOK accepted the slip, even if recording it failed
	trans_ref text,
	attempts int not null default 0,
	created_at timestamptz not null default now(),
	claimed_at timestamptz,
	finished_at timestamptz
);
create index slip_submissions_order_idx on public.slip_submissions (order_id, created_at desc);
create index slip_submissions_open_idx on public.slip_submissions (status, created_at) where status in ('QUEUED', 'CHECKING', 'NEEDS_REVIEW');
alter table public.slip_submissions enable row level security;
create policy "buyer reads own slip submissions" on public.slip_submissions for select using (customer_id = auth.uid());

-- ---------- A payment that arrives for a cancelled order is still money received ----------
drop function public.record_slip_payment(uuid, text, int);
create function public.record_slip_payment(p_order_id uuid, p_slip_ref text, p_amount int)
returns text language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype;
begin
	select * into v_order from orders where id = p_order_id for update;
	if v_order.id is null or v_order.payment_method <> 'PROMPTPAY' then raise exception 'ORDER_NOT_PAYABLE'; end if;
	if v_order.paid_at is not null then raise exception 'ALREADY_PAID'; end if;
	if p_amount <> v_order.total_price then raise exception 'SLIP_AMOUNT_MISMATCH'; end if;
	if nullif(trim(coalesce(p_slip_ref, '')), '') is null then raise exception 'SLIP_INVALID'; end if;
	begin
		update orders set paid_at = now(), slip_ref = trim(p_slip_ref) where id = p_order_id;
	exception when unique_violation then
		raise exception 'SLIP_USED';
	end;
	-- Cancelled meanwhile: stays cancelled, but paid + cancelled is exactly the refund list
	if v_order.status = 'CANCELLED' then return 'REFUND_DUE'; end if;
	insert into chat_messages (order_id, sender_role, body)
	values (p_order_id, 'SYSTEM', 'ได้รับชำระเงินแล้ว กำลังหาเพื่อนรับหิ้ว');
	return 'PAID';
end $$;

-- ---------- Queue functions (verify-slip only) ----------

-- Accepts a slip into the queue, or says why not
create function public.slip_enqueue(p_id uuid, p_order_id uuid, p_customer_id uuid, p_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
	select * into o from orders where id = p_order_id for update;
	if o.id is null or o.customer_id <> p_customer_id then raise exception 'ORDER_NOT_FOUND'; end if;
	if o.payment_method <> 'PROMPTPAY' then raise exception 'ORDER_NOT_PAYABLE'; end if;
	if o.paid_at is not null then raise exception 'ALREADY_PAID'; end if;
	if exists (select 1 from slip_submissions where order_id = o.id and status in ('QUEUED', 'CHECKING')) then raise exception 'SLIP_ALREADY_QUEUED'; end if;
	if exists (select 1 from slip_submissions where order_id = o.id and status = 'NEEDS_REVIEW') then raise exception 'SLIP_UNDER_REVIEW'; end if;
	if (select count(*) from slip_submissions where order_id = o.id and status = 'REJECTED') >= 5 then raise exception 'TOO_MANY_ATTEMPTS'; end if;
	if (select count(*) from slip_submissions where customer_id = p_customer_id and created_at > now() - interval '10 minutes') >= 8 then raise exception 'RATE_LIMITED'; end if;
	insert into slip_submissions (id, order_id, customer_id, image_path) values (p_id, o.id, p_customer_id, p_path);
	return p_id;
end $$;

-- Takes a queued slip for checking if a slot is free (at most p_max checks run at once).
-- A check that has been running too long is not repeated: SlipOK may already have accepted that slip.
create function public.slip_claim(p_id uuid, p_max int default 4) returns boolean
language plpgsql security definer set search_path = public as $$
declare s slip_submissions%rowtype;
begin
	perform pg_advisory_xact_lock(hashtext('slip_claim'));
	select * into s from slip_submissions where id = p_id for update;
	if s.id is null then return false; end if;
	if s.status = 'CHECKING' and s.claimed_at < now() - interval '2 minutes' then
		update slip_submissions set status = 'NEEDS_REVIEW', error_code = 'STUCK', finished_at = now() where id = s.id;
		return false;
	end if;
	if s.status <> 'QUEUED' then return false; end if;
	if (select count(*) from slip_submissions where status = 'CHECKING' and claimed_at > now() - interval '2 minutes') >= greatest(1, p_max) then return false; end if;
	update slip_submissions set status = 'CHECKING', claimed_at = now(), attempts = attempts + 1 where id = s.id;
	return true;
end $$;

-- p_status QUEUED = SlipOK was unreachable, try again later (3 tries, then the team looks)
create function public.slip_finish(p_id uuid, p_status text, p_code text default null, p_ref text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_status text := p_status;
begin
	if p_status not in ('QUEUED', 'PAID', 'REJECTED', 'NEEDS_REVIEW') then raise exception 'BAD_STATUS'; end if;
	if p_status = 'QUEUED' and (select attempts from slip_submissions where id = p_id) >= 3 then v_status := 'NEEDS_REVIEW'; end if;
	update slip_submissions set status = v_status, error_code = p_code, trans_ref = coalesce(nullif(trim(coalesce(p_ref, '')), ''), trans_ref),
		finished_at = case when v_status = 'QUEUED' then null else now() end
	where id = p_id and status in ('CHECKING', 'QUEUED');
end $$;

-- ---------- What the buyer sees ----------
create function public.my_slip_status(p_order_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
	select jsonb_build_object(
		'id', s.id, 'status', s.status, 'error', s.error_code, 'created_at', s.created_at,
		'ahead', (select count(*) from slip_submissions q where q.status in ('QUEUED', 'CHECKING') and q.created_at < s.created_at),
		'attempts_left', greatest(0, 5 - (select count(*) from slip_submissions r where r.order_id = s.order_id and r.status = 'REJECTED'))
	)
	from slip_submissions s
	where s.order_id = p_order_id and s.customer_id = auth.uid()
	order by s.created_at desc limit 1
$$;

-- ---------- What the team sees ----------
create function public.admin_order_slips(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'status', s.status, 'error', s.error_code, 'trans_ref', s.trans_ref,
			'created_at', s.created_at, 'finished_at', s.finished_at, 'image_path', s.image_path) order by s.created_at desc), '[]'::jsonb)
		from slip_submissions s where s.order_id = p_order_id
	);
end $$;

-- A slip waiting on the team, or stuck in the queue, is a problem someone must look at
create or replace function public.order_attention(o public.orders, p_failed int) returns jsonb
language sql stable as $$
	select coalesce(jsonb_agg(a order by a ->> 'rank'), '[]'::jsonb) from (
		select jsonb_build_object('code', 'OTP_LOCKED', 'rank', 1) a where o.status = 'DELIVERING' and p_failed >= 5
		union all
		select jsonb_build_object('code', 'REFUND_DUE', 'rank', 2, 'amount', o.total_price)
			where o.status = 'CANCELLED' and o.paid_at is not null and o.refunded_at is null
		union all
		select jsonb_build_object('code', 'SLIP_REVIEW', 'rank', 2)
			where o.paid_at is null and exists (
				select 1 from slip_submissions s where s.order_id = o.id
					and (s.status = 'NEEDS_REVIEW' or (s.status in ('QUEUED', 'CHECKING') and s.created_at < now() - interval '3 minutes')))
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

-- Manual confirmation: ADMIN any time; STAFF only when the buyer uploaded a slip the check could not settle
-- (so there is a slip image to compare with the bank app). Needs a bank reference either way.
create or replace function public.admin_confirm_payment(p_order_id uuid, p_bank_ref text) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; v_ref text := nullif(trim(coalesce(p_bank_ref, '')), ''); v_role text;
begin
	v_role := require_team();
	if v_ref is null then raise exception 'REF_REQUIRED'; end if;
	select * into o from orders where id = p_order_id for update;
	if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
	if o.payment_method <> 'PROMPTPAY' then raise exception 'ORDER_NOT_PAYABLE'; end if;
	if o.paid_at is not null then raise exception 'ALREADY_PAID'; end if;
	if o.status = 'CANCELLED' then
		-- only to book money that really arrived for an order that was cancelled (it then joins the refund list)
		if not exists (select 1 from slip_submissions where order_id = o.id and status = 'NEEDS_REVIEW') then raise exception 'ORDER_NOT_PAYABLE'; end if;
	elsif o.status <> 'PENDING' then
		raise exception 'ORDER_NOT_PAYABLE';
	end if;
	if v_role <> 'ADMIN' and not exists (select 1 from slip_submissions where order_id = o.id and status in ('NEEDS_REVIEW', 'REJECTED')) then
		raise exception 'ADMIN_ONLY';
	end if;
	begin
		update orders set paid_at = now(), slip_ref = 'MANUAL:' || v_ref, payment_confirmed_by = auth.uid() where id = o.id;
	exception when unique_violation then
		raise exception 'SLIP_USED';
	end;
	update slip_submissions set status = 'PAID', finished_at = now() where order_id = o.id and status in ('NEEDS_REVIEW', 'REJECTED');
	if o.status = 'PENDING' then
		insert into chat_messages (order_id, sender_role, body) values (o.id, 'SYSTEM', 'ได้รับชำระเงินแล้ว กำลังหาเพื่อนรับหิ้ว');
	end if;
	perform log_admin('PAYMENT_CONFIRMED', 'order', o.id::text, o.order_code, jsonb_build_object('amount', o.total_price, 'ref', v_ref, 'by_role', v_role, 'order_status', o.status));
end $$;

-- ---------- Unpaid PromptPay orders: at most 3 open, and they expire ----------
-- An order with a slip being checked or waiting for the team is not expired.
create function public.expire_unpaid_orders(p_user uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
	update orders o set status = 'CANCELLED', cancelled_at = now(), cancel_reason = 'หมดเวลาชำระเงิน (20 นาที)'
	where o.payment_method = 'PROMPTPAY' and o.status = 'PENDING' and o.paid_at is null
		and o.created_at < now() - interval '20 minutes'
		and (p_user is null or o.customer_id = p_user)
		and not exists (select 1 from slip_submissions s where s.order_id = o.id and s.status in ('QUEUED', 'CHECKING', 'NEEDS_REVIEW'));
	get diagnostics v_count = row_count;
	return v_count;
end $$;

create function public.orders_unpaid_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	if new.payment_method = 'PROMPTPAY' and new.customer_id is not null then
		perform expire_unpaid_orders(new.customer_id);
		if (select count(*) from orders where customer_id = new.customer_id and payment_method = 'PROMPTPAY' and status = 'PENDING' and paid_at is null) >= 3 then
			raise exception 'TOO_MANY_UNPAID';
		end if;
	end if;
	return new;
end $$;
create trigger orders_unpaid_guard before insert on public.orders
	for each row execute function public.orders_unpaid_guard();

do $$ begin
	perform cron.schedule('expire-unpaid-orders', '* * * * *', 'select public.expire_unpaid_orders()');
exception when others then
	raise notice 'pg_cron not available: unpaid orders expire when their buyer places the next order';
end $$;

-- ---------- Who may call what ----------
revoke execute on function
	public.record_slip_payment(uuid, text, int), public.slip_enqueue(uuid, uuid, uuid, text), public.slip_claim(uuid, int),
	public.slip_finish(uuid, text, text, text), public.expire_unpaid_orders(uuid), public.orders_unpaid_guard()
from anon, authenticated, public;
grant execute on function
	public.record_slip_payment(uuid, text, int), public.slip_enqueue(uuid, uuid, uuid, text), public.slip_claim(uuid, int),
	public.slip_finish(uuid, text, text, text), public.expire_unpaid_orders(uuid)
to service_role;
revoke execute on function public.my_slip_status(uuid), public.admin_order_slips(uuid) from anon, public;
grant execute on function public.my_slip_status(uuid), public.admin_order_slips(uuid) to authenticated;

-- ---------- The team can look at the slip images (signed links from the console) ----------
create policy "team reads payment slips" on storage.objects for select
	using (bucket_id = 'payment-slips' and public.is_team());
