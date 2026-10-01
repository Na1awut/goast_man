-- ============================================================
-- Store Operating Hours (Automated Scheduling)
-- Allows store owners (partners) to set automated operating hours
-- (e.g. 08:00 - 17:00, specific days of week) so the store
-- automatically opens and closes on schedule.
-- ============================================================

-- 1. Add operating_hours column to stores
alter table public.stores add column if not exists operating_hours jsonb;

-- 2. Partner RPC to update operating hours
create or replace function public.partner_set_operating_hours(p_hours jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
	v_store text := partner_store();
	v_name text;
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	update stores
	set operating_hours = p_hours
	where id = v_store
	returning name into v_name;

	perform log_admin(
		'STORE_OPERATING_HOURS_UPDATED',
		'store',
		v_store,
		v_name,
		jsonb_build_object('hours', p_hours, 'by', 'partner')
	);
end $$;

grant execute on function public.partner_set_operating_hours(jsonb) to authenticated;
revoke execute on function public.partner_set_operating_hours(jsonb) from anon, public;
