-- TEST DATABASE ONLY. Not a migration: do NOT put this in supabase/migrations and do not run it on the real project.
-- Support for the test site's single sign-on from the real console (functions/test-ticket + test-login):
--   * the used-ticket list that makes each ticket good for one sign-in
--   * sso_ensure_team_user(): a personal account on the test console for a real team member
-- Run with: SUPABASE_ACCESS_TOKEN=<test account token> npx supabase db query --linked=false --project-ref <test ref> -f supabase/test-site/sso.sql

create table if not exists public.sso_used_tickets (
	jti text primary key,
	used_at timestamptz not null default now()
);
alter table public.sso_used_tickets enable row level security; -- no policies: only the service role touches it
revoke all on public.sso_used_tickets from anon, authenticated;

-- A ticket lives 60 seconds; keep a day of ids
do $$ begin
	perform cron.schedule('sso-used-tickets-cleanup', '40 4 * * *', $c$delete from public.sso_used_tickets where used_at < now() - interval '1 day'$c$);
exception when others then
	raise notice 'pg_cron not available: sso_used_tickets is not cleaned up automatically';
end $$;

-- A real team member's own account on the test site: same email, same team role as on the real site,
-- no password anyone knows (the only way in is a ticket), profile filled in so they can also order.
create or replace function public.sso_ensure_team_user(p_email text, p_name text, p_role text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
	v_email text := lower(trim(coalesce(p_email, '')));
	v_name text := left(trim(coalesce(nullif(p_name, ''), split_part(v_email, '@', 1))), 60);
	v_id uuid;
	v_h bigint := abs(hashtext(v_email));
begin
	if p_role not in ('ADMIN', 'STAFF') then raise exception 'BAD_ROLE'; end if;
	if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'BAD_EMAIL'; end if;

	-- Before the account exists: the sign-up trigger reads the team list
	insert into team_members (email, role, note) values (v_email, p_role, 'เข้าจากคอนโซลจริง')
	on conflict (email) do update set role = excluded.role;

	select id into v_id from auth.users where email = v_email;
	if v_id is null then
		v_id := gen_random_uuid();
		insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
			raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
			confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
			phone_change, phone_change_token, reauthentication_token)
		values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
			crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
			'{"provider":"google","providers":["google"]}'::jsonb,
			jsonb_build_object('email_verified', true, 'full_name', v_name, 'sub', v_email, 'email', v_email),
			now(), now(), '', '', '', '', '', '', '', '');
		insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
		values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
	end if;

	update profiles set
		nickname = case when nickname = '' then left(v_name, 20) else nickname end,
		phone = coalesce(phone, '08' || lpad((v_h % 100000000)::text, 8, '0')),
		student_id = coalesce(student_id, '66' || lpad((v_h % 1000000000)::text, 9, '0')),
		faculty = coalesce(faculty, 'คณะวิทยาศาสตร์'),
		study_level = coalesce(study_level, '3'),
		consented_at = coalesce(consented_at, now()),
		terms_version = coalesce(terms_version, '2026-09')
	where id = v_id;
	return v_email;
end $$;
revoke execute on function public.sso_ensure_team_user(text, text, text) from public, anon, authenticated;
grant execute on function public.sso_ensure_team_user(text, text, text) to service_role;
