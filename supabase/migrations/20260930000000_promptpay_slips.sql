-- ============================================================
-- PromptPay paid to the team, checked with SlipOK, and rider payouts
--
-- A PromptPay order is placed first, then the buyer transfers the total to
-- the team's PromptPay and uploads the slip. The verify-slip Edge Function
-- (supabase/functions/verify-slip) checks the slip with SlipOK and records
-- the payment with record_slip_payment(). Until then the order is invisible
-- to riders and cannot be accepted.
--
-- Money flow: buyers pay the team in full. The rider pays the stall, delivers,
-- and closes the job with the buyer's OTP. The team then transfers the rider
-- what they are owed; rider_payouts_due() lists it, mark_payout_paid() records
-- the transfer. Both are for the team only (SQL Editor / service role).
-- ============================================================

alter table public.orders
	add column paid_at timestamptz,
	-- SlipOK transRef: one bank transfer pays one order, never two
	add column slip_ref text unique,
	add column payout_paid_at timestamptz,
	add column payout_ref text;

-- Riders only see and take jobs that are paid: cash is settled at the door,
-- PromptPay needs a verified slip first
drop policy "participants read orders" on public.orders;
create policy "participants read orders" on public.orders for select
	using (auth.uid() in (customer_id, rider_id)
		or (status = 'PENDING' and (payment_method = 'CASH' or paid_at is not null) and public.is_rider()));
drop policy "participants read items" on public.order_items;
create policy "participants read items" on public.order_items for select
	using (exists (select 1 from public.orders o where o.id = order_id
		and (auth.uid() in (o.customer_id, o.rider_id)
			or (o.status = 'PENDING' and (o.payment_method = 'CASH' or o.paid_at is not null) and public.is_rider()))));

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
	-- Single conditional UPDATE: two riders tapping at once cannot both win.
	-- An unpaid PromptPay order is not a job yet.
	update orders set status = 'ACCEPTED', rider_id = auth.uid(), accepted_at = now()
	where id = p_order_id and status = 'PENDING' and customer_id <> auth.uid()
		and (payment_method = 'CASH' or paid_at is not null);
	if not found then raise exception 'ALREADY_TAKEN'; end if;
end $$;

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
					and (o.payment_method = 'CASH' or o.paid_at is not null)
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

-- Called only by the verify-slip Edge Function (service role) after SlipOK
-- accepted the slip. Re-checks everything the database can check itself.
create or replace function public.record_slip_payment(p_order_id uuid, p_slip_ref text, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype;
begin
	select * into v_order from orders where id = p_order_id for update;
	if v_order.id is null or v_order.payment_method <> 'PROMPTPAY' or v_order.status = 'CANCELLED' then
		raise exception 'ORDER_NOT_PAYABLE';
	end if;
	if v_order.paid_at is not null then raise exception 'ALREADY_PAID'; end if;
	if p_amount <> v_order.total_price then raise exception 'SLIP_AMOUNT_MISMATCH'; end if;
	if nullif(trim(coalesce(p_slip_ref, '')), '') is null then raise exception 'SLIP_INVALID'; end if;
	begin
		update orders set paid_at = now(), slip_ref = trim(p_slip_ref) where id = p_order_id;
	exception when unique_violation then
		raise exception 'SLIP_USED';
	end;
	insert into chat_messages (order_id, sender_role, body)
	values (p_order_id, 'SYSTEM', 'ได้รับชำระเงินแล้ว กำลังหาเพื่อนรับหิ้ว');
end $$;

-- What the team still owes riders for finished jobs.
-- The rider paid the stall (food_total) and earns the delivery fee; cash they
-- collected at the door counts against that. PromptPay orders therefore owe
-- food + fee; cash orders owe only what discounts took off the door price.
-- Tips are not included: nobody pays the tip in yet (see PLAN.md).
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
		o.food_total + o.delivery_fee - case when o.payment_method = 'CASH' then o.total_price else 0 end
	from orders o join profiles p on p.id = o.rider_id
	where o.status = 'COMPLETED' and o.payout_paid_at is null
		and o.food_total + o.delivery_fee - case when o.payment_method = 'CASH' then o.total_price else 0 end > 0
	order by p.nickname, o.completed_at
$$;

-- The team transferred a rider their money: record it so it drops off the list
create or replace function public.mark_payout_paid(p_order_ids uuid[], p_transfer_ref text)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
	update orders set payout_paid_at = now(), payout_ref = nullif(trim(coalesce(p_transfer_ref, '')), '')
	where id = any(p_order_ids) and status = 'COMPLETED' and payout_paid_at is null;
	get diagnostics v_count = row_count;
	return v_count;
end $$;

revoke execute on function public.record_slip_payment(uuid, text, int), public.rider_payouts_due(), public.mark_payout_paid(uuid[], text)
	from anon, authenticated, public;
grant execute on function public.record_slip_payment(uuid, text, int), public.rider_payouts_due(), public.mark_payout_paid(uuid[], text)
	to service_role;
