-- ============================================================
-- The team sets stores up itself
--
-- Stores are being rebuilt from scratch (the mock-up goes) before the stall
-- owners have given their emails. So the team (ADMIN and STAFF) can now,
-- from the console:
-- - create a store with no owner yet (it starts hidden and closed),
-- - edit every store exactly as a partner edits their own: details, logo,
--   photo, banner, tagline, Fast lane, and the whole menu with photos,
-- - hide a store from the app (mock-ups, stores not ready) and clear a
--   store's menu in one go (ADMIN).
-- When the owner's email arrives, the existing invite links the store to them;
-- the team can still edit it afterwards.
--
-- Partner and team edits run through the same store_* functions, so both
-- follow one set of rules. Every change goes to admin_log with who made it.
-- ============================================================

alter table public.stores add column hidden boolean not null default false;

-- Signed-in team member (for policies; true/false only)
create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public as $$
	select public.team_role() is not null
$$;

-- Hidden stores are for the team only
drop policy "stores are public" on public.stores;
create policy "stores are public" on public.stores for select using (not hidden or public.is_team());

-- The team uploads photos into any store's folder
create policy "team writes store images" on storage.objects for insert to authenticated
	with check (bucket_id = 'store-banners' and public.is_team()
		and (storage.foldername(name))[1] in (select id from public.stores));
create policy "team updates store images" on storage.objects for update to authenticated
	using (bucket_id = 'store-banners' and public.is_team()
		and (storage.foldername(name))[1] in (select id from public.stores));
create policy "team deletes store images" on storage.objects for delete to authenticated
	using (bucket_id = 'store-banners' and public.is_team()
		and (storage.foldername(name))[1] in (select id from public.stores));

-- ---------- One implementation, used by partners (own store) and the team (any store) ----------

create or replace function public.store_save_menu_item(
	p_store text, p_by text,
	p_id text, p_name text, p_category text, p_price int, p_special_price int,
	p_description text, p_image_url text, p_available boolean
) returns text
language plpgsql security definer set search_path = public as $$
declare
	v_name text := trim(coalesce(p_name, ''));
	v_category text := trim(coalesce(p_category, ''));
	v_description text := trim(coalesce(p_description, ''));
	v_image text := trim(coalesce(p_image_url, ''));
	v_old menu_items%rowtype;
	v_id text := nullif(trim(coalesce(p_id, '')), '');
	v_store_name text;
begin
	if char_length(v_name) not between 1 and 80 then raise exception 'BAD_ITEM_NAME'; end if;
	if char_length(v_category) not between 1 and 40 then raise exception 'BAD_CATEGORY'; end if;
	if p_price is null or p_price not between 1 and 2000 then raise exception 'BAD_PRICE'; end if;
	if p_special_price is not null and (p_special_price <= p_price or p_special_price > 2000) then raise exception 'BAD_SPECIAL_PRICE'; end if;
	if char_length(v_description) > 200 then raise exception 'NOTE_TOO_LONG'; end if;
	if v_id is not null then
		select * into v_old from menu_items where id = v_id and store_id = p_store and not archived;
		if v_old.id is null then raise exception 'ITEM_NOT_FOUND'; end if;
	end if;
	-- A new photo must be in the store's own folder; an unchanged one may stay
	if v_image <> '' and v_image is distinct from v_old.image_url and not is_store_image(v_image, p_store) then
		raise exception 'BAD_IMAGE';
	end if;
	if v_id is null then
		v_id := p_store || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
		insert into menu_items (id, store_id, name, price, special_price, description, image_url, category, is_available, sort)
		values (v_id, p_store, v_name, p_price, p_special_price, v_description, v_image, v_category, coalesce(p_available, true),
			(select coalesce(max(sort), 0) + 1 from menu_items where store_id = p_store));
	else
		update menu_items set name = v_name, price = p_price, special_price = p_special_price, description = v_description,
			image_url = v_image, category = v_category, is_available = coalesce(p_available, is_available)
		where id = v_id;
	end if;
	select name into v_store_name from stores where id = p_store;
	perform log_admin(case when v_old.id is null then 'ITEM_ADDED' else 'ITEM_EDITED' end, 'store', p_store, v_store_name,
		jsonb_build_object('item_id', v_id, 'item', v_name, 'price', p_price, 'was', v_old.price, 'by', p_by));
	return v_id;
end $$;

create or replace function public.store_remove_menu_item(p_store text, p_by text, p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare v_item text; v_store_name text;
begin
	update menu_items set archived = true where id = p_id and store_id = p_store and not archived returning name into v_item;
	if v_item is null then raise exception 'ITEM_NOT_FOUND'; end if;
	select name into v_store_name from stores where id = p_store;
	perform log_admin('ITEM_REMOVED', 'store', p_store, v_store_name, jsonb_build_object('item_id', p_id, 'item', v_item, 'by', p_by));
end $$;

create or replace function public.store_update_info(p_store text, p_by text, p_name text, p_category text, p_description text, p_queue_minutes int)
returns void language plpgsql security definer set search_path = public as $$
declare
	v_name text := trim(coalesce(p_name, ''));
	v_category text := trim(coalesce(p_category, ''));
	v_description text := trim(coalesce(p_description, ''));
	v_old stores%rowtype;
begin
	if char_length(v_name) not between 1 and 60 then raise exception 'BAD_STORE_NAME'; end if;
	if char_length(v_category) not between 1 and 40 then raise exception 'BAD_CATEGORY'; end if;
	if char_length(v_description) > 200 then raise exception 'NOTE_TOO_LONG'; end if;
	if p_queue_minutes is null or p_queue_minutes not between 0 and 120 then raise exception 'BAD_QUEUE'; end if;
	select * into v_old from stores where id = p_store;
	if v_old.id is null then raise exception 'STORE_NOT_FOUND'; end if;
	update stores set name = v_name, category = v_category, description = v_description, queue_minutes = p_queue_minutes where id = p_store;
	perform log_admin('STORE_EDITED', 'store', p_store, v_name,
		jsonb_build_object('was', case when v_old.name <> v_name then v_old.name end, 'by', p_by));
end $$;

create or replace function public.store_update_storefront(
	p_store text, p_by text, p_tagline text, p_banner_url text, p_fast_lane_minutes int, p_logo_url text, p_image_url text
) returns void language plpgsql security definer set search_path = public as $$
declare
	v_store stores%rowtype;
	v_banner text := nullif(trim(coalesce(p_banner_url, '')), '');
	v_logo text := nullif(trim(coalesce(p_logo_url, '')), '');
	v_image text := nullif(trim(coalesce(p_image_url, '')), '');
begin
	select * into v_store from stores where id = p_store;
	if v_store.id is null then raise exception 'STORE_NOT_FOUND'; end if;
	if (v_banner is distinct from v_store.banner_url and v_banner is not null and not is_store_image(v_banner, v_store.id))
		or (v_logo is distinct from v_store.logo_url and v_logo is not null and not is_store_image(v_logo, v_store.id))
		or (v_image is distinct from v_store.image_url and v_image is not null and not is_store_image(v_image, v_store.id)) then
		raise exception 'BAD_IMAGE';
	end if;
	if p_fast_lane_minutes is not null and p_fast_lane_minutes not between 1 and 60 then raise exception 'BAD_FAST_LANE'; end if;
	update stores set
		tagline = nullif(trim(coalesce(p_tagline, '')), ''),
		banner_url = v_banner,
		fast_lane_minutes = p_fast_lane_minutes,
		logo_url = v_logo,
		-- A store keeps its photo: an empty value leaves the current one
		image_url = coalesce(v_image, image_url)
	where id = v_store.id;
	if p_by = 'team' then
		perform log_admin('STORE_EDITED', 'store', p_store, v_store.name, jsonb_build_object('what', 'storefront', 'by', p_by));
	end if;
end $$;

-- ---------- Partners: their own store, through the same functions ----------

create or replace function public.partner_save_menu_item(
	p_id text, p_name text, p_category text, p_price int, p_special_price int,
	p_description text, p_image_url text, p_available boolean default true
) returns text
language plpgsql security definer set search_path = public as $$
declare v_store text := partner_store();
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	return store_save_menu_item(v_store, 'partner', p_id, p_name, p_category, p_price, p_special_price, p_description, p_image_url, p_available);
end $$;

create or replace function public.partner_remove_menu_item(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare v_store text := partner_store();
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	perform store_remove_menu_item(v_store, 'partner', p_id);
end $$;

create or replace function public.partner_update_store_info(p_name text, p_category text, p_description text, p_queue_minutes int) returns void
language plpgsql security definer set search_path = public as $$
declare v_store text := partner_store();
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	perform store_update_info(v_store, 'partner', p_name, p_category, p_description, p_queue_minutes);
end $$;

create or replace function public.update_storefront(p_tagline text, p_banner_url text, p_fast_lane_minutes int, p_logo_url text, p_image_url text)
returns void language plpgsql security definer set search_path = public as $$
declare v_store text;
begin
	select s.id into v_store from stores s
	where s.id = (select partner_store_id from profiles where id = auth.uid() and role = 'PARTNER') and s.owner_id = auth.uid();
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	perform store_update_storefront(v_store, 'partner', p_tagline, p_banner_url, p_fast_lane_minutes, p_logo_url, p_image_url);
end $$;

-- ---------- The team: any store ----------

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
	select coalesce(max((regexp_match(id, '^' || v_prefix || '-(\d+)$'))[1]::int), 0) + 1 into v_next
	from stores where id ~ ('^' || v_prefix || '-\d+$');
	v_id := v_prefix || '-' || lpad(v_next::text, 2, '0');
	insert into stores (id, zone, name, category, description, image_url, lock, is_open, hidden)
	values (v_id, v_zone, 'ร้านใหม่', 'ร้านอาหาร', '', '', trim(coalesce(p_lock, '')), false, true);
	perform store_update_info(v_id, 'team', p_name, p_category, p_description, coalesce(p_queue_minutes, 10));
	perform log_admin('STORE_CREATED', 'store', v_id, trim(p_name), jsonb_build_object('zone', v_zone));
	return v_id;
end $$;

create or replace function public.admin_update_store_info(p_store_id text, p_name text, p_category text, p_description text, p_queue_minutes int)
returns void language plpgsql security definer set search_path = public as $$
begin
	perform require_team();
	perform store_update_info(p_store_id, 'team', p_name, p_category, p_description, p_queue_minutes);
end $$;

create or replace function public.admin_update_storefront(
	p_store_id text, p_tagline text, p_banner_url text, p_fast_lane_minutes int, p_logo_url text, p_image_url text
) returns void language plpgsql security definer set search_path = public as $$
begin
	perform require_team();
	perform store_update_storefront(p_store_id, 'team', p_tagline, p_banner_url, p_fast_lane_minutes, p_logo_url, p_image_url);
end $$;

create or replace function public.admin_save_menu_item(
	p_store_id text, p_id text, p_name text, p_category text, p_price int, p_special_price int,
	p_description text, p_image_url text, p_available boolean default true
) returns text
language plpgsql security definer set search_path = public as $$
begin
	perform require_team();
	if not exists (select 1 from stores where id = p_store_id) then raise exception 'STORE_NOT_FOUND'; end if;
	return store_save_menu_item(p_store_id, 'team', p_id, p_name, p_category, p_price, p_special_price, p_description, p_image_url, p_available);
end $$;

create or replace function public.admin_remove_menu_item(p_store_id text, p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
	perform require_team();
	perform store_remove_menu_item(p_store_id, 'team', p_id);
end $$;

-- Take every dish off a store's menu (e.g. the mock-up) — ADMIN only; returns how many
create or replace function public.admin_clear_menu(p_store_id text) returns int
language plpgsql security definer set search_path = public as $$
declare v_count int; v_name text;
begin
	perform require_team(true);
	select name into v_name from stores where id = p_store_id;
	if v_name is null then raise exception 'STORE_NOT_FOUND'; end if;
	update menu_items set archived = true where store_id = p_store_id and not archived;
	get diagnostics v_count = row_count;
	perform log_admin('MENU_CLEARED', 'store', p_store_id, v_name, jsonb_build_object('items', v_count));
	return v_count;
end $$;

-- Hide a store from the app (it also stops taking orders); show it again when ready
create or replace function public.admin_set_store_hidden(p_store_id text, p_hidden boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
	perform require_team();
	update stores set hidden = coalesce(p_hidden, false), is_open = case when p_hidden then false else is_open end
	where id = p_store_id returning name into v_name;
	if v_name is null then raise exception 'STORE_NOT_FOUND'; end if;
	perform log_admin(case when p_hidden then 'STORE_HIDDEN' else 'STORE_SHOWN' end, 'store', p_store_id, v_name);
end $$;

-- The console's store list: also hidden, owner or invite, and what is still missing
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
		from stores s
	);
end $$;

revoke execute on function
	public.store_save_menu_item(text, text, text, text, text, int, int, text, text, boolean),
	public.store_remove_menu_item(text, text, text),
	public.store_update_info(text, text, text, text, text, int),
	public.store_update_storefront(text, text, text, text, int, text, text)
from anon, authenticated, public;
grant execute on function public.is_team() to anon, authenticated;
grant execute on function
	public.admin_create_store(text, text, text, text, text, int),
	public.admin_update_store_info(text, text, text, text, int),
	public.admin_update_storefront(text, text, text, int, text, text),
	public.admin_save_menu_item(text, text, text, text, int, int, text, text, boolean),
	public.admin_remove_menu_item(text, text),
	public.admin_clear_menu(text),
	public.admin_set_store_hidden(text, boolean)
to authenticated;
revoke execute on function
	public.admin_create_store(text, text, text, text, text, int),
	public.admin_update_store_info(text, text, text, text, int),
	public.admin_update_storefront(text, text, text, int, text, text),
	public.admin_save_menu_item(text, text, text, text, int, int, text, text, boolean),
	public.admin_remove_menu_item(text, text),
	public.admin_clear_menu(text),
	public.admin_set_store_hidden(text, boolean)
from anon, public;
