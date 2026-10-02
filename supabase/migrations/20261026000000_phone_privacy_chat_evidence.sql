-- ============================================================
-- Phone privacy, and chat kept as evidence
--
-- - A rider's phone number is never shown to anyone in the app (the buyer used
--   to get it with their order). The team still sees it in the console.
-- - A buyer's phone number reaches a rider only while the job is in hand
--   (ACCEPTED / DELIVERING): rider_board() already returns it for no other
--   status, so it disappears the moment the order ends.
-- - Chat stays for the team to read back: admin_order_chat() lists an order's
--   messages (and their photos) at any age, and no chat message younger than
--   10 days can be deleted from the app side (the dashboard SQL editor, where
--   nobody is signed in, is not blocked).
-- ============================================================

-- The buyer's orders, without the rider's phone
create or replace function public.my_orders(p_order_id uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
	select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb)
	from (
		select o.*,
			case when o.status in ('ACCEPTED', 'DELIVERING') then s.otp_code end as otp_code,
			(
				select jsonb_agg(jsonb_build_object(
					'menu_item_id', i.menu_item_id,
					'special', i.special,
					'name', i.name,
					'price', i.price,
					'quantity', i.quantity,
					'selected_options', coalesce(i.selected_options, '[]'::jsonb)
				))
				from order_items i where i.order_id = o.id
			) as items,
			case when o.rider_id is not null then (
				select jsonb_build_object(
					'id', p.id, 'name', p.nickname, 'full_name', p.full_name,
					'faculty', trim(both ' ·' from concat_ws(' · ', nullif(p.faculty, ''), nullif(level_label(p.study_level), ''))),
					'rating', coalesce((select round(avg(rating)::numeric, 2) from orders r where r.rider_id = p.id and r.rating is not null), 5),
					'jobs', (select count(*) from orders r where r.rider_id = p.id and r.status = 'COMPLETED')
				) from profiles p where p.id = o.rider_id
			) end as rider
		from orders o
		left join order_secrets s on s.order_id = o.id
		where o.customer_id = auth.uid() and (p_order_id is null or o.id = p_order_id)
	) x
$$;

-- ---------- Chat as evidence ----------

create or replace function public.chat_keep_days() returns int language sql immutable as $$ select 10 $$;

create or replace function public.keep_recent_chat() returns trigger
language plpgsql as $$
begin
	-- Signed-in users (and the app) may not erase recent chat; the SQL editor (no user) may
	if auth.uid() is not null and old.created_at > now() - make_interval(days => chat_keep_days()) then
		raise exception 'CHAT_KEPT';
	end if;
	return old;
end $$;
create trigger chat_messages_keep_recent before delete on public.chat_messages
	for each row execute function public.keep_recent_chat();

-- The team reads an order's whole chat, however old
create or replace function public.admin_order_chat(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(jsonb_build_object(
			'id', m.id, 'at', m.created_at, 'role', m.sender_role,
			'by', coalesce(nullif(p.nickname, ''), p.full_name, ''),
			'body', m.body, 'image_path', m.image_path
		) order by m.created_at), '[]'::jsonb)
		from chat_messages m left join profiles p on p.id = m.sender_id
		where m.order_id = p_order_id
	);
end $$;

-- ...and opens the photos in it
create policy "team reads chat images" on storage.objects for select to authenticated
	using (bucket_id = 'chat-images' and public.is_team());

grant execute on function public.admin_order_chat(uuid) to authenticated;
revoke execute on function public.admin_order_chat(uuid) from anon, public;
