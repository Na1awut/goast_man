-- ============================================================
-- Store logo + store photo, managed by the partner
--
-- Partners already upload a storefront banner. They now also set:
--   logo_url   the store's logo (shown as "Goose Man × logo" on joint promos)
--   image_url  the store photo used in lists and cards
-- Every image a partner saves must live in their own folder of the
-- store-banners bucket, so a partner cannot point the app at an
-- arbitrary outside image. Unchanged values are always accepted, which
-- keeps admin-set photos (e.g. from seed.sql) working.
-- ============================================================

alter table public.stores add column logo_url text;

-- store-banners/<store_id>/<file>, on this project's storage
create or replace function public.is_store_image(p_url text, p_store_id text) returns boolean
language sql immutable as $$
	select p_url ~ ('/storage/v1/object/public/store-banners/' || regexp_replace(p_store_id, '([^a-zA-Z0-9_-])', '\\\1', 'g') || '/[^/]+$')
$$;

drop function public.update_storefront(text, text, int);

create or replace function public.update_storefront(
	p_tagline text,
	p_banner_url text,
	p_fast_lane_minutes int,
	p_logo_url text,
	p_image_url text
) returns void
language plpgsql security definer set search_path = public as $$
declare
	v_store stores%rowtype;
	v_banner text := nullif(trim(coalesce(p_banner_url, '')), '');
	v_logo text := nullif(trim(coalesce(p_logo_url, '')), '');
	v_image text := nullif(trim(coalesce(p_image_url, '')), '');
begin
	select s.* into v_store from stores s
	where s.id = (select partner_store_id from profiles where id = auth.uid() and role = 'PARTNER')
		and s.owner_id = auth.uid();
	if v_store.id is null then raise exception 'PARTNER_ONLY'; end if;

	if (v_banner is distinct from v_store.banner_url and v_banner is not null and not is_store_image(v_banner, v_store.id))
		or (v_logo is distinct from v_store.logo_url and v_logo is not null and not is_store_image(v_logo, v_store.id))
		or (v_image is distinct from v_store.image_url and v_image is not null and not is_store_image(v_image, v_store.id)) then
		raise exception 'BAD_IMAGE';
	end if;

	update stores set
		tagline = nullif(trim(p_tagline), ''),
		banner_url = v_banner,
		fast_lane_minutes = p_fast_lane_minutes,
		logo_url = v_logo,
		-- A store always has a photo: an empty value keeps the current one
		image_url = coalesce(v_image, image_url)
	where id = v_store.id;
end $$;

revoke execute on function public.update_storefront(text, text, int, text, text), public.is_store_image(text, text) from anon, public;
grant execute on function public.update_storefront(text, text, int, text, text) to authenticated;
