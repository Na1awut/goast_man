-- ============================================================
-- QR test mode exists only on the test project
--
-- "จ่ายแบบทดสอบ" marks an order paid without a transfer. That is for the test
-- site (its own database), never for the real one, where a switch left on would
-- mean free food for everyone. The test database is marked by a row
-- ('is_test_project' = true, set by supabase/test-site/test-project.sql, which
-- is not a migration). Without that row payment_test_mode() is always false,
-- the console switch refuses, and pay_order_test() cannot run.
-- ============================================================

create or replace function public.is_test_project() returns boolean
language sql stable security definer set search_path = public as $$
	select coalesce((select value = 'true'::jsonb from app_settings where key = 'is_test_project'), false)
$$;
revoke execute on function public.is_test_project() from anon, authenticated, public;

create or replace function public.payment_test_mode() returns boolean
language sql stable security definer set search_path = public as $$
	select is_test_project() and coalesce((select value = 'true'::jsonb from app_settings where key = 'payment_test_mode'), false)
$$;

create or replace function public.admin_set_payment_test_mode(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
	perform require_team(true);
	if not is_test_project() then raise exception 'TEST_PROJECT_ONLY'; end if;
	update app_settings set value = to_jsonb(coalesce(p_on, false)), updated_at = now(),
		updated_by = (select coalesce(nullif(nickname, ''), nullif(full_name, ''), email) from profiles where id = auth.uid())
	where key = 'payment_test_mode';
	perform log_admin(case when p_on then 'PAYMENT_TEST_ON' else 'PAYMENT_TEST_OFF' end, 'setting', 'payment_test_mode', 'โหมดทดสอบจ่าย QR');
end $$;

-- Whatever it was before, it is off now
update public.app_settings set value = 'false'::jsonb, updated_at = now() where key = 'payment_test_mode';
