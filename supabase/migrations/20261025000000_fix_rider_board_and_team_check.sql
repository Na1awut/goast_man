-- ============================================================
-- Fixes for regressions found when the SQL tests first ran 20261017-24
--
-- 1. is_team() (20261020) said yes to anyone not signed in, so a visitor with
--    the public anon key could edit home banners and see hidden stores.
--    Signed-in team members (and profiles marked ADMIN) only, as before.
-- 2. rider_board() (20261018) lost 'online', tip and store_discount: the rider
--    app showed "offline" after switching on and every job's tip as 0.
-- 3. order_items' key was (order, item, special), but the cart keeps the same
--    item with different options as separate lines, so such an order failed.
--    Lines now get their own id; an exact duplicate line is still refused.
-- 4. Functions added since 20261018 kept Postgres' default EXECUTE for
--    everyone. store_save_menu_item() is an inner helper with no checks of its
--    own (any store's menu), and the owner functions skip the team check when
--    nobody is signed in. Only the app's signed-in paths may call them now.
-- ============================================================

create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public as $$
	select auth.uid() is not null and (
		public.team_role() is not null
		or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'::public.user_role)
	)
$$;

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
					(select jsonb_agg(jsonb_build_object('name', i.name, 'price', i.price, 'quantity', i.quantity, 'selected_options', coalesce(i.selected_options, '[]'::jsonb)))
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
					(select jsonb_agg(jsonb_build_object('name', i.name, 'price', i.price, 'quantity', i.quantity, 'selected_options', coalesce(i.selected_options, '[]'::jsonb)))
						from order_items i where i.order_id = o.id) as items,
					jsonb_build_object('nickname', p.nickname, 'phone', coalesce(p.phone, '')) as customer
				from orders o join profiles p on p.id = o.customer_id
				where o.rider_id = auth.uid() and o.status in ('ACCEPTED', 'DELIVERING')
			) j
		)
	) end
$$;

alter table public.order_items drop constraint order_items_pkey;
alter table public.order_items add column line_id bigint generated always as identity primary key;
create unique index order_items_one_line on public.order_items (order_id, menu_item_id, special, selected_options);

revoke execute on function public.store_save_menu_item(text, text, text, text, text, int, int, text, text, boolean, jsonb) from anon, authenticated, public;
revoke execute on function public.admin_unlink_store_owner(text), public.admin_invite_partner(text, text),
	public.admin_save_home_banner(text, text, text, text, text, text, boolean, int), public.admin_delete_home_banner(text),
	public.admin_save_menu_item(text, text, text, text, int, int, text, text, boolean, jsonb),
	public.partner_save_menu_item(text, text, text, int, int, text, text, boolean, jsonb)
from anon, public;
revoke execute on function public.is_store_image(text, text) from anon, public;
