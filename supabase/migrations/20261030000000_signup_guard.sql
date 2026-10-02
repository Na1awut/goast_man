-- ============================================================
-- Sign-up guard: no fake KMUTT emails, no account floods
--
-- Found on live (2026-10-02): the Email provider was still on in Supabase
-- Auth, so anyone with the public anon key could call auth.signUp() with any
-- "...@kmutt.ac.th" address and get a student profile. And handle_new_user
-- trusted unverified Microsoft claims (email / preferred_username / upn).
--
-- Every new account now has to:
--   1. come from Google or Microsoft sign-in (not email + password / magic link),
--   2. carry email_verified = true from that provider,
--   3. if Microsoft, come from the KMUTT tenant (tid below), so nobody can
--      set "@kmutt.ac.th" on a user in a tenant of their own,
--   4. fit the rate limit: at most signup_limit_per_minute new accounts in any
--      60 seconds (default 20) and 10x that per hour. Team members and invited
--      partners always get in, so a flood can't lock the team out.
-- Also turn off Authentication → Providers → Email in the Supabase dashboard,
-- and keep Auth → Rate Limits on; this is the database-side backstop.
-- ============================================================

insert into public.app_settings (key, value) values ('signup_limit_per_minute', '20') on conflict (key) do nothing;

create or replace function public.signup_limit_per_minute() returns int
language sql stable security definer set search_path = public as $$
	select coalesce((select (value #>> '{}')::int from app_settings where key = 'signup_limit_per_minute'), 20)
$$;

/** KMUTT's Microsoft Entra tenant: every Microsoft account so far comes from it */
create or replace function public.kmutt_azure_tenant() returns text
language sql immutable as $$ select '6f4432dc-20d2-441d-b1db-ac3380ba633d' $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
	-- Only the address Supabase Auth itself recorded; provider claims are not trusted
	v_email text := lower(trim(coalesce(new.email, '')));
	v_name text := coalesce(
		nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
		nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
		split_part(v_email, '@', 1),
		''
	);
	v_provider text := coalesce(new.raw_app_meta_data ->> 'provider', '');
	v_invite partner_invites%rowtype;
	v_team boolean;
	v_limit int;
begin
	select * into v_invite from partner_invites where email = v_email;
	v_team := exists (select 1 from team_members where email = v_email);

	-- Who may have an account at all
	if v_email = '' or not (v_invite.email is not null or public.is_kmutt_email(v_email) or v_team) then
		raise exception 'KMUTT_ONLY: sign-up is limited to @kmutt.ac.th accounts, invited partner stores and the Goose Man team';
	end if;

	-- How they proved it
	if v_provider not in ('google', 'azure') then
		raise exception 'OAUTH_ONLY: sign in with Google or Microsoft';
	end if;
	if coalesce(new.raw_user_meta_data ->> 'email_verified', '') <> 'true' then
		raise exception 'EMAIL_UNVERIFIED: the provider did not verify this email';
	end if;
	if v_provider = 'azure' and coalesce(new.raw_user_meta_data -> 'custom_claims' ->> 'tid', '') <> public.kmutt_azure_tenant() then
		raise exception 'KMUTT_TENANT_ONLY: Microsoft sign-in is for KMUTT accounts';
	end if;

	-- How many at once: one lock so concurrent sign-ups count each other
	if v_invite.email is null and not v_team then
		perform pg_advisory_xact_lock(hashtext('goose-signup-rate'));
		v_limit := public.signup_limit_per_minute();
		if (select count(*) from auth.users where id <> new.id and created_at > now() - interval '1 minute') >= v_limit
			or (select count(*) from auth.users where id <> new.id and created_at > now() - interval '1 hour') >= v_limit * 10 then
			raise exception 'SIGNUP_BUSY: too many new accounts right now, try again in a minute';
		end if;
	end if;

	if v_invite.email is not null then
		insert into profiles (id, email, full_name, nickname, role, partner_store_id)
		values (new.id, v_email, v_name, split_part(v_name, ' ', 1), 'PARTNER', v_invite.store_id)
		on conflict (id) do update set
			email = excluded.email,
			full_name = coalesce(nullif(profiles.full_name, ''), excluded.full_name);
		update stores set owner_id = new.id, is_partner = true where id = v_invite.store_id;
		delete from partner_invites where email = v_email;
	elsif public.is_kmutt_email(v_email) then
		insert into profiles (id, email, full_name, nickname, role)
		values (new.id, v_email, v_name, split_part(v_name, ' ', 1), 'STUDENT')
		on conflict (id) do update set
			email = excluded.email,
			full_name = coalesce(nullif(profiles.full_name, ''), excluded.full_name);
	else
		insert into profiles (id, email, full_name, nickname, role)
		values (new.id, v_email, v_name, split_part(v_name, ' ', 1), 'ADMIN')
		on conflict (id) do update set
			email = excluded.email,
			full_name = coalesce(nullif(profiles.full_name, ''), excluded.full_name);
	end if;
	return new;
end $$;

revoke execute on function public.signup_limit_per_minute(), public.kmutt_azure_tenant(), public.handle_new_user() from anon, authenticated, public;
