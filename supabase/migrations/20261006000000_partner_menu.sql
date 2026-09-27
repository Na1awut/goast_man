-- ============================================================
-- Partners run their own menu and store details (decision D5: the store
-- edits, no team approval). The menus loaded so far are a mock-up of the
-- real stalls; each store now replaces it with its own dishes, prices and
-- photos.
--
-- - partner_save_menu_item(): add a dish or change one (name, category,
--   price, พิเศษ price, description, photo, on sale).
-- - partner_remove_menu_item(): take a dish off the menu. Dishes that were
--   ordered before are referenced by old orders, so they are archived, not
--   deleted: buyers, the team and the store stop seeing them.
-- - partner_update_store_info(): name, category, description, queue time.
-- Photos must be in the store's own folder (store-banners/<store_id>/...),
-- like the banner and logo. Every change goes to admin_log.
-- ============================================================

alter table public.menu_items add column archived boolean not null default false;

drop policy "menus are public" on public.menu_items;
create policy "menus are public" on public.menu_items for select using (not archived);

-- An archived dish can never be switched back on sale (not even from the console)
create or replace function public.keep_archived_off() returns trigger
language plpgsql as $$
begin
	if new.archived then new.is_available := false; end if;
	return new;
end $$;
create trigger menu_items_archived_off before insert or update on public.menu_items
	for each row execute function public.keep_archived_off();

-- The console's store menu hides archived dishes too
create or replace function public.admin_store_menu(p_store_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'price', m.price, 'special_price', m.special_price,
			'category', m.category, 'is_available', m.is_available) order by m.sort, m.id), '[]'::jsonb)
		from menu_items m where m.store_id = p_store_id and not m.archived
	);
end $$;

-- Add (p_id null) or change a dish of the partner's own store; returns its id
create or replace function public.partner_save_menu_item(
	p_id text,
	p_name text,
	p_category text,
	p_price int,
	p_special_price int,
	p_description text,
	p_image_url text,
	p_available boolean default true
) returns text
language plpgsql security definer set search_path = public as $$
declare
	v_store text := partner_store();
	v_store_name text;
	v_name text := trim(coalesce(p_name, ''));
	v_category text := trim(coalesce(p_category, ''));
	v_description text := trim(coalesce(p_description, ''));
	v_image text := trim(coalesce(p_image_url, ''));
	v_old menu_items%rowtype;
	v_id text := nullif(trim(coalesce(p_id, '')), '');
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	if char_length(v_name) not between 1 and 80 then raise exception 'BAD_ITEM_NAME'; end if;
	if char_length(v_category) not between 1 and 40 then raise exception 'BAD_CATEGORY'; end if;
	if p_price is null or p_price not between 1 and 2000 then raise exception 'BAD_PRICE'; end if;
	if p_special_price is not null and (p_special_price <= p_price or p_special_price > 2000) then raise exception 'BAD_SPECIAL_PRICE'; end if;
	if char_length(v_description) > 200 then raise exception 'NOTE_TOO_LONG'; end if;

	if v_id is not null then
		select * into v_old from menu_items where id = v_id and store_id = v_store and not archived;
		if v_old.id is null then raise exception 'ITEM_NOT_FOUND'; end if;
	end if;
	-- A new photo must be the store's own upload; an unchanged one (e.g. the mock-up) may stay
	if v_image <> '' and v_image is distinct from v_old.image_url and not is_store_image(v_image, v_store) then
		raise exception 'BAD_IMAGE';
	end if;

	if v_id is null then
		v_id := v_store || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
		insert into menu_items (id, store_id, name, price, special_price, description, image_url, category, is_available, sort)
		values (v_id, v_store, v_name, p_price, p_special_price, v_description, v_image, v_category, coalesce(p_available, true),
			(select coalesce(max(sort), 0) + 1 from menu_items where store_id = v_store));
	else
		update menu_items set name = v_name, price = p_price, special_price = p_special_price, description = v_description,
			image_url = v_image, category = v_category, is_available = coalesce(p_available, is_available)
		where id = v_id;
	end if;

	select name into v_store_name from stores where id = v_store;
	perform log_admin(case when v_old.id is null then 'ITEM_ADDED' else 'ITEM_EDITED' end, 'store', v_store, v_store_name,
		jsonb_build_object('item_id', v_id, 'item', v_name, 'price', p_price, 'was', v_old.price, 'by', 'partner'));
	return v_id;
end $$;

create or replace function public.partner_remove_menu_item(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare v_store text := partner_store(); v_item text; v_store_name text;
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	update menu_items set archived = true where id = p_id and store_id = v_store and not archived returning name into v_item;
	if v_item is null then raise exception 'ITEM_NOT_FOUND'; end if;
	select name into v_store_name from stores where id = v_store;
	perform log_admin('ITEM_REMOVED', 'store', v_store, v_store_name, jsonb_build_object('item_id', p_id, 'item', v_item, 'by', 'partner'));
end $$;

create or replace function public.partner_update_store_info(p_name text, p_category text, p_description text, p_queue_minutes int) returns void
language plpgsql security definer set search_path = public as $$
declare
	v_store text := partner_store();
	v_name text := trim(coalesce(p_name, ''));
	v_category text := trim(coalesce(p_category, ''));
	v_description text := trim(coalesce(p_description, ''));
	v_old stores%rowtype;
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	if char_length(v_name) not between 1 and 60 then raise exception 'BAD_STORE_NAME'; end if;
	if char_length(v_category) not between 1 and 40 then raise exception 'BAD_CATEGORY'; end if;
	if char_length(v_description) > 200 then raise exception 'NOTE_TOO_LONG'; end if;
	if p_queue_minutes is null or p_queue_minutes not between 0 and 120 then raise exception 'BAD_QUEUE'; end if;
	select * into v_old from stores where id = v_store;
	update stores set name = v_name, category = v_category, description = v_description, queue_minutes = p_queue_minutes where id = v_store;
	perform log_admin('STORE_EDITED', 'store', v_store, v_name,
		jsonb_build_object('was', case when v_old.name <> v_name then v_old.name end, 'by', 'partner'));
end $$;

revoke execute on function public.keep_archived_off() from anon, authenticated, public;
grant execute on function
	public.partner_save_menu_item(text, text, text, int, int, text, text, boolean),
	public.partner_remove_menu_item(text), public.partner_update_store_info(text, text, text, int)
to authenticated;
revoke execute on function
	public.partner_save_menu_item(text, text, text, int, int, text, text, boolean),
	public.partner_remove_menu_item(text), public.partner_update_store_info(text, text, text, int)
from anon, public;
