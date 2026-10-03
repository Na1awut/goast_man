-- TEST DATABASE ONLY (not a migration; never run on the real project).
-- Marks this database as the test project. Only here may "QR test mode" (pay without a transfer) work:
-- migration 20261101 makes payment_test_mode() false everywhere else, whatever the switch says.
-- Run with: SUPABASE_ACCESS_TOKEN=<test account token> npx supabase db query --linked=false --project-ref <test ref> -f supabase/test-site/test-project.sql
insert into public.app_settings (key, value) values ('is_test_project', 'true')
on conflict (key) do update set value = 'true'::jsonb;
update public.app_settings set value = 'true'::jsonb, updated_at = now() where key = 'payment_test_mode';
