-- ============================================================
-- Support Microsoft (Azure AD) OAuth in handle_new_user
-- Microsoft tokens often place the student email in preferred_username
-- or userPrincipalName rather than new.email.
-- Fall back to these claims so @kmutt.ac.th and @mail.kmutt.ac.th
-- accounts are accepted correctly and not rejected with KMUTT_ONLY.
-- ============================================================

create or replace function public.is_kmutt_email(p_email text) returns boolean
language sql immutable as $$
	select split_part(lower(trim(coalesce(p_email, ''))), '@', 2) in ('kmutt.ac.th', 'mail.kmutt.ac.th')
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
	v_email text := lower(trim(coalesce(
		nullif(new.email, ''),
		nullif(new.raw_user_meta_data ->> 'email', ''),
		nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
		nullif(new.raw_user_meta_data ->> 'upn', ''),
		nullif(new.raw_user_meta_data ->> 'userPrincipalName', '')
	)));
	v_name text := coalesce(
		nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
		nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
		split_part(v_email, '@', 1),
		''
	);
	v_invite partner_invites%rowtype;
begin
	-- If auth.users.email was empty (common with Microsoft Azure AD), fill it from claims
	if (new.email is null or new.email = '') and v_email is not null then
		update auth.users set email = v_email where id = new.id;
	end if;

	select * into v_invite from partner_invites where email = v_email;

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
	elsif exists (select 1 from team_members where email = v_email) then
		insert into profiles (id, email, full_name, nickname, role)
		values (new.id, v_email, v_name, split_part(v_name, ' ', 1), 'ADMIN')
		on conflict (id) do update set
			email = excluded.email,
			full_name = coalesce(nullif(profiles.full_name, ''), excluded.full_name);
	else
		raise exception 'KMUTT_ONLY: sign-up is limited to @kmutt.ac.th accounts, invited partner stores and the Goose Man team';
	end if;
	return new;
end $$;
