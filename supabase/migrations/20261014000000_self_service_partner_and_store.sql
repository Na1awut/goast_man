-- ============================================================
-- Self-Service Partner & Store Claiming (No Hardcoding Required)
-- Allows shop owners to register their store or claim an unassigned store
-- and fixes admin_invite_partner for accounts that already exist.
-- ============================================================

-- 1. Fix admin_invite_partner: allow assigning existing accounts to stores
create or replace function public.admin_invite_partner(p_email text, p_store_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
	v_email text := lower(trim(coalesce(p_email, '')));
	v_store text;
	v_existing_user uuid;
begin
	perform require_team(true);
	if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'BAD_EMAIL'; end if;
	select name into v_store from stores where id = p_store_id and deleted_at is null;
	if v_store is null then raise exception 'STORE_NOT_FOUND'; end if;

	-- Check if user already has an account
	select id into v_existing_user from profiles where email = v_email;

	if v_existing_user is not null then
		-- User already signed in before: immediately link them as store owner
		update profiles set role = 'PARTNER', partner_store_id = p_store_id where id = v_existing_user;
		update stores set owner_id = v_existing_user, is_partner = true where id = p_store_id;
		delete from partner_invites where email = v_email;
		perform log_admin('PARTNER_ASSIGNED', 'store', p_store_id, v_store, jsonb_build_object('email', v_email, 'user_id', v_existing_user));
	else
		-- User hasn't signed in yet: save invite so handle_new_user picks it up
		insert into partner_invites (email, store_id) values (v_email, p_store_id)
		on conflict (email) do update set store_id = excluded.store_id, created_at = now();
		perform log_admin('PARTNER_INVITED', 'store', p_store_id, v_store, jsonb_build_object('email', v_email));
	end if;
end $$;

-- 2. Partner Self-Service: Register a new store directly from the app
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
		v_zone := 'kfc';
	end;

	-- Generate clean unique id
	v_slug := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
	if length(v_slug) < 2 then v_slug := 'shop'; end if;
	v_id := substring(v_slug from 1 for 20) || '-' || floor(random() * 900 + 100)::int;

	-- Create store with caller as owner (hidden until reviewed/opened)
	insert into stores (id, name, category, zone, description, owner_id, is_partner, hidden, is_open)
	values (
		v_id,
		trim(p_name),
		coalesce(nullif(trim(p_category), ''), 'อาหารทั่วไป'),
		v_zone,
		trim(coalesce(p_description, '')),
		v_user_id,
		true,
		false,
		false
	);

	-- Upgrade user to PARTNER and link store
	update profiles
	set role = 'PARTNER', partner_store_id = v_id
	where id = v_user_id;

	return v_id;
end $$;

-- 3. Partner Self-Service: Claim an existing unassigned store
create or replace function public.partner_claim_store(
	p_store_id text
) returns void
language plpgsql security definer set search_path = public as $$
declare
	v_user_id uuid := auth.uid();
	v_store stores%rowtype;
begin
	if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
	select * into v_store from stores where id = p_store_id and deleted_at is null;
	if v_store.id is null then raise exception 'STORE_NOT_FOUND'; end if;

	-- Cannot claim a store that already belongs to someone else
	if v_store.owner_id is not null and v_store.owner_id != v_user_id then
		raise exception 'STORE_ALREADY_OWNED';
	end if;

	-- Assign ownership
	update stores set owner_id = v_user_id, is_partner = true where id = p_store_id;
	update profiles set role = 'PARTNER', partner_store_id = p_store_id where id = v_user_id;
end $$;

-- 4. Grant permissions
grant execute on function public.partner_register_store(text, text, text, text) to authenticated;
grant execute on function public.partner_claim_store(text) to authenticated;
