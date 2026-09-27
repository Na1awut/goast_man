-- ============================================================
-- Team members may sign in with a personal email (e.g. Gmail)
--
-- Sign-up stays closed to everyone else: a new account is accepted only for
-- a KMUTT email, an invited partner store, or an email an ADMIN has put on
-- the team list. A team account that is not a KMUTT email gets the profile
-- role ADMIN ("team account, not a student"): it cannot become a rider
-- (riders must be STUDENT) and the role grants nothing by itself; what it may
-- do in the console still comes from team_members.
-- ============================================================

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
	v_email text := lower(new.email);
	v_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '');
	v_invite partner_invites%rowtype;
begin
	select * into v_invite from partner_invites where email = v_email;

	if v_invite.email is not null then
		insert into profiles (id, email, full_name, nickname, role, partner_store_id)
		values (new.id, v_email, v_name, split_part(v_name, ' ', 1), 'PARTNER', v_invite.store_id);
		update stores set owner_id = new.id, is_partner = true where id = v_invite.store_id;
		delete from partner_invites where email = v_email;
	elsif public.is_kmutt_email(v_email) then
		insert into profiles (id, email, full_name, nickname, role)
		values (new.id, v_email, v_name, split_part(v_name, ' ', 1), 'STUDENT');
	elsif exists (select 1 from team_members where email = v_email) then
		insert into profiles (id, email, full_name, nickname, role)
		values (new.id, v_email, v_name, split_part(v_name, ' ', 1), 'ADMIN');
	else
		raise exception 'KMUTT_ONLY: sign-up is limited to @kmutt.ac.th accounts, invited partner stores and the Goose Man team';
	end if;
	return new;
end $$;

-- ADMINs may add any email to the team (KMUTT or personal); it just has to look like an email
create or replace function public.admin_set_member(p_email text, p_role text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_old text;
begin
	perform require_team(true);
	if p_role not in ('ADMIN', 'STAFF') then raise exception 'BAD_ROLE'; end if;
	if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'BAD_EMAIL'; end if;
	if v_email = (select email from profiles where id = auth.uid()) then raise exception 'CANNOT_CHANGE_SELF'; end if;
	select role into v_old from team_members where email = v_email;
	insert into team_members (email, role, note, added_by) values (v_email, p_role, nullif(trim(coalesce(p_note, '')), ''), auth.uid())
	on conflict (email) do update set role = excluded.role;
	perform log_admin(case when v_old is null then 'MEMBER_ADDED' else 'MEMBER_ROLE_CHANGED' end, 'member', v_email, v_email,
		jsonb_build_object('role', p_role, 'was', v_old));
end $$;

-- Joint promotions: only a team ADMIN (or the SQL Editor) approves. The profile
-- role ADMIN no longer counts, since personal-email STAFF accounts carry it too.
create or replace function public.guard_promotion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	-- No signed-in user = SQL editor, seed or service role: trust as admin
	if auth.uid() is null or public.team_role() = 'ADMIN' then
		return new;
	end if;
	if new.kind = 'DEAL' then
		new.approved := true;
	elsif tg_op = 'INSERT' then
		new.approved := false;
	elsif (new.title, new.description, new.min_qty, new.discount, new.free_delivery, new.banner_url, new.ends_at, new.kind)
		is distinct from
		(old.title, old.description, old.min_qty, old.discount, old.free_delivery, old.banner_url, old.ends_at, old.kind) then
		new.approved := false;
	else
		new.approved := old.approved;
	end if;
	return new;
end $$;
