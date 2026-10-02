-- ============================================================
-- Security review fixes (claude-code-security-review, 2026-10-02)
--
-- 1. admin_unlink_store_owner / admin_invite_partner skipped require_team()
--    when nobody was signed in (20261021). Always check now.
-- 2. partner_claim_store let any student take any store without an owner.
--    A store is claimed only with a pending invite for the caller's email.
-- 3. partner_register_store published the new store at once. It now starts
--    hidden and closed until the team shows it, and a hidden store can never
--    be open (trigger), whoever tries.
-- 4. Option prices came from the client. Every selected option must match the
--    menu's own choice (id, name, price) and the group's limits.
-- 5. is_team() also trusted profiles.role = 'ADMIN', which survives removal
--    from the team. team_members is the only source of truth again.
-- ============================================================

-- ---------- 1. Owner changes are team-only, always ----------
CREATE OR REPLACE FUNCTION public.admin_unlink_store_owner(p_store_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
	v_store_name text;
	v_prev_owner_id uuid;
	v_prev_owner_email text;
BEGIN
	-- Always: a signed-out caller must not skip the check
	PERFORM require_team(true);

	SELECT name, owner_id INTO v_store_name, v_prev_owner_id
	FROM stores
	WHERE id = p_store_id AND deleted_at IS NULL;

	IF v_store_name IS NULL THEN
		RAISE EXCEPTION 'STORE_NOT_FOUND';
	END IF;

	-- Unlink previous owner's profile if any
	IF v_prev_owner_id IS NOT NULL THEN
		SELECT email INTO v_prev_owner_email FROM profiles WHERE id = v_prev_owner_id;

		UPDATE profiles
		SET partner_store_id = NULL,
		    role = CASE WHEN role = 'PARTNER'::public.user_role THEN 'STUDENT'::public.user_role ELSE role END
		WHERE id = v_prev_owner_id AND partner_store_id = p_store_id;
	END IF;

	-- Clear owner from store
	UPDATE stores
	SET owner_id = NULL, is_partner = false
	WHERE id = p_store_id;

	-- Also clear any pending invites for this store
	DELETE FROM partner_invites WHERE store_id = p_store_id;

	BEGIN
		PERFORM log_admin(
			'PARTNER_UNLINKED',
			'store',
			p_store_id,
			v_store_name,
			jsonb_build_object('prev_owner', v_prev_owner_email)
		);
	EXCEPTION WHEN OTHERS THEN
		NULL;
	END;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_invite_partner(p_email text, p_store_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
	v_email text := lower(trim(coalesce(p_email, '')));
	v_store_name text;
	v_prev_owner_id uuid;
	v_prev_owner_email text;
	v_new_user_id uuid;
BEGIN
	-- Always: a signed-out caller must not skip the check
	PERFORM require_team(true);

	IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
		RAISE EXCEPTION 'BAD_EMAIL';
	END IF;

	SELECT name, owner_id INTO v_store_name, v_prev_owner_id
	FROM stores
	WHERE id = p_store_id AND deleted_at IS NULL;

	IF v_store_name IS NULL THEN
		RAISE EXCEPTION 'STORE_NOT_FOUND';
	END IF;

	-- If this store already had an owner different from the new email, unlink the previous owner
	IF v_prev_owner_id IS NOT NULL THEN
		SELECT email INTO v_prev_owner_email FROM profiles WHERE id = v_prev_owner_id;

		IF lower(trim(coalesce(v_prev_owner_email, ''))) <> v_email THEN
			UPDATE profiles
			SET partner_store_id = NULL,
			    role = CASE WHEN role = 'PARTNER'::public.user_role THEN 'STUDENT'::public.user_role ELSE role END
			WHERE id = v_prev_owner_id AND partner_store_id = p_store_id;

			UPDATE stores SET owner_id = NULL, is_partner = false WHERE id = p_store_id;
		ELSE
			-- Already owned by this email
			RETURN;
		END IF;
	END IF;

	-- Remove any previous pending invites for this store
	DELETE FROM partner_invites WHERE store_id = p_store_id;

	-- Check if the target email already has an account
	SELECT id INTO v_new_user_id FROM profiles WHERE lower(trim(email)) = v_email;

	IF v_new_user_id IS NOT NULL THEN
		-- Link existing account immediately
		UPDATE profiles
		SET role = 'PARTNER'::public.user_role, partner_store_id = p_store_id
		WHERE id = v_new_user_id;

		UPDATE stores
		SET owner_id = v_new_user_id, is_partner = true
		WHERE id = p_store_id;

		DELETE FROM partner_invites WHERE lower(trim(email)) = v_email;

		BEGIN
			PERFORM log_admin(
				'PARTNER_ASSIGNED',
				'store',
				p_store_id,
				v_store_name,
				jsonb_build_object('email', v_email, 'user_id', v_new_user_id, 'prev_owner', v_prev_owner_email)
			);
		EXCEPTION WHEN OTHERS THEN
			NULL;
		END;
	ELSE
		-- User hasn't signed in yet: save invite so handle_new_user picks it up
		INSERT INTO partner_invites (email, store_id)
		VALUES (v_email, p_store_id)
		ON CONFLICT (email) DO UPDATE SET store_id = excluded.store_id, created_at = now();

		BEGIN
			PERFORM log_admin(
				'PARTNER_INVITED',
				'store',
				p_store_id,
				v_store_name,
				jsonb_build_object('email', v_email, 'prev_owner', v_prev_owner_email)
			);
		EXCEPTION WHEN OTHERS THEN
			NULL;
		END;
	END IF;
END;
$$;

-- ---------- 2. Claiming needs an invite ----------
create or replace function public.partner_claim_store(p_store_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
	v_user_id uuid := auth.uid();
	v_email text;
	v_store stores%rowtype;
begin
	if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
	select * into v_store from stores where id = p_store_id and deleted_at is null;
	if v_store.id is null then raise exception 'STORE_NOT_FOUND'; end if;
	if v_store.owner_id = v_user_id then return; end if;
	if v_store.owner_id is not null then raise exception 'STORE_ALREADY_OWNED'; end if;

	select lower(trim(email)) into v_email from profiles where id = v_user_id;
	if not exists (select 1 from partner_invites where lower(trim(email)) = v_email and store_id = p_store_id) then
		raise exception 'CLAIM_NEEDS_INVITE';
	end if;

	update stores set owner_id = v_user_id, is_partner = true where id = p_store_id;
	update profiles set role = 'PARTNER', partner_store_id = p_store_id where id = v_user_id;
	delete from partner_invites where lower(trim(email)) = v_email;
end $$;

-- ---------- 3. A self-registered store waits for the team ----------
create or replace function public.partner_register_store(
	p_name text,
	p_category text,
	p_zone text,
	p_description text default ''
) returns text
language plpgsql security definer set search_path = public as $$
declare
	v_id text;
	v_slug text;
	v_user_id uuid := auth.uid();
	v_zone store_zone;
begin
	if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
	if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_TOO_SHORT'; end if;

	-- Validate zone
	begin
		v_zone := p_zone::store_zone;
	exception when others then
		v_zone := 'kfc-main';
	end;

	-- Generate clean unique id
	v_slug := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
	if length(v_slug) < 2 then v_slug := 'shop'; end if;
	v_id := substring(v_slug from 1 for 20) || '-' || floor(random() * 900 + 100)::int;

	-- Create store with caller as owner: hidden and closed until the team shows it
	insert into stores (id, name, category, zone, description, owner_id, is_partner, hidden, is_open)
	values (
		v_id,
		trim(p_name),
		coalesce(nullif(trim(p_category), ''), 'อาหารทั่วไป'),
		v_zone,
		trim(coalesce(p_description, '')),
		v_user_id,
		true,
		true,
		false
	);

	-- Upgrade user to PARTNER and link store
	update profiles
	set role = 'PARTNER', partner_store_id = v_id
	where id = v_user_id;

	return v_id;
end $$;

create or replace function public.keep_hidden_store_shut() returns trigger
language plpgsql as $$
begin
	if new.hidden then new.is_open := false; end if;
	return new;
end $$;
-- Named to fire after stores_keep_deleted_shut (BEFORE triggers run in name order)
create trigger stores_zz_hidden_shut before insert or update on public.stores
	for each row execute function public.keep_hidden_store_shut();

create or replace function public.partner_set_store_open(p_open boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_store text := partner_store(); v_name text; v_hidden boolean;
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	select hidden into v_hidden from stores where id = v_store;
	if v_hidden and p_open then raise exception 'STORE_PENDING_REVIEW'; end if;
	update stores set is_open = coalesce(p_open, false) where id = v_store returning name into v_name;
	perform log_admin(case when p_open then 'STORE_OPENED' else 'STORE_CLOSED' end, 'store', v_store, v_name, '{"by": "partner"}');
end $$;

-- ---------- 4. Options are priced by the menu, not the buyer ----------
create or replace function public.check_order_item_options() returns trigger
language plpgsql security definer set search_path = public as $$
declare
	v_groups jsonb;
	v_sel jsonb := coalesce(new.selected_options, '[]'::jsonb);
	e jsonb;
	g jsonb;
	c jsonb;
begin
	if jsonb_typeof(v_sel) <> 'array' then raise exception 'OPTION_CHANGED'; end if;
	select coalesce(options, '[]'::jsonb) into v_groups from menu_items where id = new.menu_item_id;

	for e in select * from jsonb_array_elements(v_sel) loop
		g := null;
		c := null;
		select x into g from jsonb_array_elements(v_groups) x where x ->> 'id' = e ->> 'groupId';
		select y into c from jsonb_array_elements(coalesce(g -> 'choices', '[]'::jsonb)) y where y ->> 'id' = e ->> 'choiceId';
		if c is null
			or (e ->> 'name') is distinct from (c ->> 'name')
			or coalesce((e ->> 'price')::numeric, 0) <> coalesce((c ->> 'price')::numeric, 0) then
			raise exception 'OPTION_CHANGED';
		end if;
	end loop;

	-- No choice twice, no more than the group allows, every required group answered
	if exists (select 1 from jsonb_array_elements(v_sel) s group by s ->> 'choiceId' having count(*) > 1) then
		raise exception 'OPTION_CHANGED';
	end if;
	for g in select * from jsonb_array_elements(v_groups) loop
		if (select count(*) from jsonb_array_elements(v_sel) s where s ->> 'groupId' = g ->> 'id')
			> coalesce((g ->> 'maxChoices')::int, 1)
			or (coalesce((g ->> 'required')::boolean, false)
				and not exists (select 1 from jsonb_array_elements(v_sel) s where s ->> 'groupId' = g ->> 'id')) then
			raise exception 'OPTION_CHANGED';
		end if;
	end loop;
	return new;
end $$;
create trigger order_items_check_options before insert on public.order_items
	for each row execute function public.check_order_item_options();

-- ---------- 5. Team means team_members ----------
create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public as $$
	select auth.uid() is not null and public.team_role() is not null
$$;

revoke execute on function public.keep_hidden_store_shut(), public.check_order_item_options() from anon, authenticated, public;
revoke execute on function public.admin_unlink_store_owner(text), public.admin_invite_partner(text, text),
	public.partner_claim_store(text), public.partner_register_store(text, text, text, text), public.partner_set_store_open(boolean)
from anon, public;
grant execute on function public.admin_unlink_store_owner(text), public.admin_invite_partner(text, text),
	public.partner_claim_store(text), public.partner_register_store(text, text, text, text), public.partner_set_store_open(boolean)
to authenticated;
