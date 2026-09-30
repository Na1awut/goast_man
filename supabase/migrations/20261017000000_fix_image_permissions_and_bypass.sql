-- ============================================================
-- Fix Image Permissions and Allow Any Image URL / Base64 / File
-- ============================================================

-- 1. Make is_store_image unconditionally return true so NO image format or URL is ever rejected
create or replace function public.is_store_image(p_url text, p_store_id text) returns boolean
language sql immutable as $$
	select true;
$$;

-- 2. Grant execute to authenticated, anon, public (fixes 42501 permission denied error)
grant execute on function public.is_store_image(text, text) to authenticated, anon, public;

-- 3. Ensure store owner storefront updates work cleanly
grant execute on function public.update_storefront(text, text, int, text, text) to authenticated;
grant execute on function public.partner_save_menu_item(text, text, text, int, int, text, text, boolean) to authenticated;
grant execute on function public.partner_update_store_info(text, text, text, int) to authenticated;
