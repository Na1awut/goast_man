-- ============================================================
-- Store open / closed: one source of truth, decided by the database
--
-- Before: the opening hours a shop saved were applied by the shop's own browser
-- (a 20-second timer on the dashboard page), "closed by hand today" lived in that
-- browser's localStorage, and admin_set_store_open() wrote stores.is_open
-- directly. So a team member closing a store was reopened by the shop's page
-- a few seconds later, and nothing worked while the page was shut.
--
-- Now stores.is_open is always the *effective* state, computed here in this
-- order (first match wins):
--   1. hidden or deleted store                      -> closed
--   2. TEAM LOCK  (the team closed it; the owner cannot reopen)  -> closed
--   3. OVERRIDE   (someone pressed open/closed, with an expiry)  -> that
--   4. SCHEDULE   (weekly hours, enabled)                        -> by the clock
--   5. nothing set (legacy rows)                                 -> as stored
-- A 30-second pg_cron job re-evaluates every store, every write to a store is
-- recomputed by a trigger, and placing an order asks store_open_now() fresh.
-- The owner's page and the team console only *read* this state and *ask* for
-- changes through the RPCs below. Times are Bangkok time.
-- ============================================================

-- ---------- Who set what (private: no policy, functions only) ----------

create table public.store_open_control (
	store_id text primary key references public.stores on delete cascade,
	locked boolean not null default false,
	lock_reason text not null default '',
	lock_by text not null default '',
	lock_at timestamptz,
	/** null = until the team releases it */
	lock_until timestamptz,
	override text check (override in ('OPEN', 'CLOSED')),
	/** null = until changed (a store without a schedule is just switched by hand) */
	override_until timestamptz,
	override_by text check (override_by in ('OWNER', 'TEAM')),
	override_by_name text not null default '',
	override_at timestamptz,
	/** +1 on every change; a screen that sends the rev it saw is refused if someone else changed things meanwhile */
	rev int not null default 0,
	updated_at timestamptz not null default now()
);
alter table public.store_open_control enable row level security;

-- ---------- The weekly schedule ----------

-- hours = { enabled, openTime "HH:MM", closeTime "HH:MM", days: [0..6] (0 = Sunday; omitted = every day) }
-- A session belongs to the day it starts: 18:00-02:00 on Friday runs until Saturday 02:00.
-- (Not enabled = "no schedule" = true, like the app's isWithinHours.)
create or replace function public.store_schedule_open(p_hours jsonb, p_at timestamptz default now()) returns boolean
language plpgsql stable set search_path = public as $$
declare
	v_o text := coalesce(nullif(p_hours ->> 'openTime', ''), '08:00');
	v_c text := coalesce(nullif(p_hours ->> 'closeTime', ''), '17:00');
	v_open int;
	v_close int;
	v_days int[];
	v_local timestamp := p_at at time zone 'Asia/Bangkok';
	v_min int := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
	v_dow int := extract(dow from v_local)::int;
	v_prev int := (extract(dow from v_local)::int + 6) % 7;
begin
	if p_hours ->> 'enabled' is distinct from 'true' then return true; end if;
	if v_o !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then v_o := '08:00'; end if;
	if v_c !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then v_c := '17:00'; end if;
	v_open := split_part(v_o, ':', 1)::int * 60 + split_part(v_o, ':', 2)::int;
	v_close := split_part(v_c, ':', 1)::int * 60 + split_part(v_c, ':', 2)::int;
	select array_agg(x::int) into v_days
	from jsonb_array_elements_text(case when jsonb_typeof(p_hours -> 'days') = 'array' then p_hours -> 'days' else '[]'::jsonb end) x
	where x ~ '^[0-6]$';
	if v_days is null or cardinality(v_days) = 0 then v_days := '{0,1,2,3,4,5,6}'; end if;

	if v_open <= v_close then
		return v_dow = any (v_days) and v_min >= v_open and v_min < v_close;
	end if;
	-- overnight: tonight's session, or the tail of yesterday's
	return (v_dow = any (v_days) and v_min >= v_open) or (v_prev = any (v_days) and v_min < v_close);
end $$;

-- The next moment (after p_at) the schedule changes between open and closed; null if it never does
create or replace function public.store_schedule_next(p_hours jsonb, p_at timestamptz default now()) returns timestamptz
language plpgsql stable set search_path = public as $$
declare
	v_o text := coalesce(nullif(p_hours ->> 'openTime', ''), '08:00');
	v_c text := coalesce(nullif(p_hours ->> 'closeTime', ''), '17:00');
	v_open int;
	v_close int;
	v_days int[];
	v_today date := (p_at at time zone 'Asia/Bangkok')::date;
	v_now boolean;
	v_cands timestamptz[] := '{}';
	v_day date;
	v_t timestamptz;
	i int;
begin
	if p_hours ->> 'enabled' is distinct from 'true' then return null; end if;
	if v_o !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then v_o := '08:00'; end if;
	if v_c !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then v_c := '17:00'; end if;
	v_open := split_part(v_o, ':', 1)::int * 60 + split_part(v_o, ':', 2)::int;
	v_close := split_part(v_c, ':', 1)::int * 60 + split_part(v_c, ':', 2)::int;
	select array_agg(x::int) into v_days
	from jsonb_array_elements_text(case when jsonb_typeof(p_hours -> 'days') = 'array' then p_hours -> 'days' else '[]'::jsonb end) x
	where x ~ '^[0-6]$';
	if v_days is null or cardinality(v_days) = 0 then v_days := '{0,1,2,3,4,5,6}'; end if;

	v_now := public.store_schedule_open(p_hours, p_at);
	-- Every session start and end within a week either side is a candidate; the first one that flips the state wins
	for i in -1..8 loop
		v_day := v_today + i;
		continue when not (extract(dow from v_day)::int = any (v_days));
		v_cands := v_cands || ((v_day::timestamp + make_interval(mins => v_open)) at time zone 'Asia/Bangkok');
		v_cands := v_cands || (((v_day + case when v_open <= v_close then 0 else 1 end)::timestamp + make_interval(mins => v_close)) at time zone 'Asia/Bangkok');
	end loop;
	for v_t in select distinct t from unnest(v_cands) t where t > p_at order by t loop
		if public.store_schedule_open(p_hours, v_t) <> v_now then return v_t; end if;
	end loop;
	return null;
end $$;

-- Check and tidy what a screen sends; anything odd is refused (BAD_HOURS)
create or replace function public.store_hours_normalize(p_hours jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
	v_enabled boolean;
	v_o text;
	v_c text;
	v_days jsonb;
begin
	if p_hours is null or jsonb_typeof(p_hours) = 'null' then return jsonb_build_object('enabled', false); end if;
	if jsonb_typeof(p_hours) <> 'object' then raise exception 'BAD_HOURS'; end if;
	if jsonb_typeof(p_hours -> 'enabled') is distinct from 'boolean' then raise exception 'BAD_HOURS'; end if;
	v_enabled := (p_hours ->> 'enabled')::boolean;
	v_o := coalesce(nullif(p_hours ->> 'openTime', ''), '08:00');
	v_c := coalesce(nullif(p_hours ->> 'closeTime', ''), '17:00');
	if v_o !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v_c !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'BAD_HOURS'; end if;
	if v_enabled and v_o = v_c then raise exception 'BAD_HOURS'; end if;

	v_days := p_hours -> 'days';
	if v_days is not null and jsonb_typeof(v_days) <> 'null' then
		if jsonb_typeof(v_days) <> 'array' then raise exception 'BAD_HOURS'; end if;
		if exists (select 1 from jsonb_array_elements(v_days) d where jsonb_typeof(d) <> 'number' or (d #>> '{}') !~ '^[0-6]$') then raise exception 'BAD_HOURS'; end if;
		select coalesce(jsonb_agg(d order by d), '[]'::jsonb) into v_days from (select distinct (x #>> '{}')::int d from jsonb_array_elements(v_days) x) q;
		if jsonb_array_length(v_days) = 0 and v_enabled then raise exception 'BAD_HOURS'; end if;
		if jsonb_array_length(v_days) in (0, 7) then v_days := null; end if;
	else
		v_days := null;
	end if;

	return jsonb_strip_nulls(jsonb_build_object('enabled', v_enabled, 'openTime', v_o, 'closeTime', v_c, 'days', v_days));
end $$;

-- ---------- The decision ----------

create or replace function public.store_open_calc(p_id text, p_hidden boolean, p_deleted timestamptz, p_hours jsonb, p_cur boolean, p_at timestamptz default now()) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare c store_open_control%rowtype;
begin
	if coalesce(p_hidden, false) or p_deleted is not null then return false; end if;
	select * into c from store_open_control where store_id = p_id;
	if found then
		if c.locked and (c.lock_until is null or c.lock_until > p_at) then return false; end if;
		if c.override is not null and (c.override_until is null or c.override_until > p_at) then return c.override = 'OPEN'; end if;
	end if;
	if p_hours ->> 'enabled' = 'true' then return public.store_schedule_open(p_hours, p_at); end if;
	return coalesce(p_cur, false);
end $$;

create or replace function public.store_open_now(p_id text, p_at timestamptz default now()) returns boolean
language sql stable security definer set search_path = public as $$
	select public.store_open_calc(s.id, s.hidden, s.deleted_at, s.operating_hours, s.is_open, p_at) from stores s where s.id = p_id
$$;

-- Bring stores.is_open in line with the decision (and say so to the trigger below)
create or replace function public.refresh_store_open(p_id text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v boolean := public.store_open_now(p_id);
begin
	perform set_config('goose.store_refresh', 'on', true);
	update stores set is_open = v where id = p_id and is_open is distinct from v;
	perform set_config('goose.store_refresh', 'off', true);
	return v;
end $$;

create or replace function public.refresh_all_store_open() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
	perform set_config('goose.store_refresh', 'on', true);
	update stores s set is_open = public.store_open_now(s.id) where s.is_open is distinct from public.store_open_now(s.id);
	get diagnostics n = row_count;
	perform set_config('goose.store_refresh', 'off', true);
	-- Expired overrides and locks only tidy the record; the decision above already ignores them
	update store_open_control set override = null, override_until = null, override_by = null, override_by_name = '', override_at = null
	where override is not null and override_until <= now();
	update store_open_control set locked = false, lock_reason = '', lock_by = '', lock_at = null, lock_until = null
	where locked and lock_until <= now();
	return n;
end $$;

-- Every write to a store ends with the right is_open. A hand-run UPDATE of is_open
-- (SQL editor, a script: nobody signed in) is kept as a team override instead of being undone.
create or replace function public.stores_apply_open_state() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	if tg_op = 'UPDATE' and new.is_open is distinct from old.is_open
		and coalesce(current_setting('goose.store_refresh', true), '') <> 'on' and auth.uid() is null then
		insert into store_open_control (store_id, override, override_by, override_by_name, override_at, rev)
		values (new.id, case when new.is_open then 'OPEN' else 'CLOSED' end, 'TEAM', 'SQL', now(), 1)
		on conflict (store_id) do update set
			override = excluded.override, override_until = null, override_by = 'TEAM', override_by_name = 'SQL',
			override_at = now(), rev = store_open_control.rev + 1, updated_at = now();
	end if;
	new.is_open := public.store_open_calc(new.id, new.hidden, new.deleted_at, new.operating_hours, new.is_open);
	return new;
end $$;
-- "zzz" so it runs after the other BEFORE triggers on stores
create trigger stores_zzz_open_state before insert or update on public.stores
	for each row execute function public.stores_apply_open_state();

-- ---------- What a screen shows ----------

create or replace function public.store_open_status(p_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
	s stores%rowtype;
	c store_open_control%rowtype;
	v_at timestamptz := now();
	v_sched boolean;
	v_lock boolean;
	v_ovr boolean;
begin
	select * into s from stores where id = p_id;
	if s.id is null then raise exception 'STORE_NOT_FOUND'; end if;
	select * into c from store_open_control where store_id = p_id;
	v_sched := coalesce(s.operating_hours ->> 'enabled' = 'true', false);
	v_lock := found and c.locked and (c.lock_until is null or c.lock_until > v_at);
	v_ovr := found and c.override is not null and (c.override_until is null or c.override_until > v_at);
	return jsonb_build_object(
		'is_open', public.store_open_calc(s.id, s.hidden, s.deleted_at, s.operating_hours, s.is_open, v_at),
		'source', case
			when s.hidden or s.deleted_at is not null then 'HIDDEN'
			when v_lock then 'TEAM_LOCK'
			when v_ovr then 'OVERRIDE'
			when v_sched then 'SCHEDULE'
			else 'MANUAL' end,
		'schedule', s.operating_hours,
		'schedule_open', case when v_sched then public.store_schedule_open(s.operating_hours, v_at) end,
		'next_change', case when v_sched then public.store_schedule_next(s.operating_hours, v_at) end,
		'lock', case when v_lock then jsonb_build_object('reason', c.lock_reason, 'by', c.lock_by, 'at', c.lock_at, 'until', c.lock_until) end,
		'override', case when v_ovr then jsonb_build_object('value', c.override, 'by', c.override_by, 'by_name', c.override_by_name, 'at', c.override_at, 'until', c.override_until) end,
		'rev', coalesce(c.rev, 0),
		'now', v_at
	);
end $$;

-- ---------- Changing it: always through here, one store at a time ----------

-- Lock the store's rows, create its control row, and refuse if the caller's screen is out of date
create or replace function public.store_open_touch(p_id text, p_rev int) returns store_open_control
language plpgsql security definer set search_path = public as $$
declare c store_open_control; v_deleted timestamptz;
begin
	select deleted_at into v_deleted from stores where id = p_id for update;
	if not found then raise exception 'STORE_NOT_FOUND'; end if;
	if v_deleted is not null then raise exception 'STORE_DELETED'; end if;
	insert into store_open_control (store_id) values (p_id) on conflict (store_id) do nothing;
	select * into c from store_open_control where store_id = p_id for update;
	if p_rev is not null and c.rev <> p_rev then raise exception 'STORE_STATE_CHANGED'; end if;
	return c;
end $$;

create or replace function public.store_actor_name() returns text
language sql stable security definer set search_path = public as $$
	select coalesce(nullif(p.nickname, ''), nullif(p.full_name, ''), p.email, '') from profiles p where p.id = auth.uid()
$$;

/**
 * Press open / closed. With a schedule an override only lasts until the schedule next
 * changes (so tomorrow is back to normal), and opening outside the hours lasts p_hours
 * (default 4). Without a schedule it is simply the switch, until someone changes it.
 */
create or replace function public.store_apply_override(p_id text, p_open boolean, p_extra_hours int, p_by text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
	v_hours jsonb;
	v_sched boolean;
	v_sched_open boolean;
	v_until timestamptz;
	v_at timestamptz := now();
begin
	if p_extra_hours is not null and p_extra_hours not between 1 and 12 then raise exception 'BAD_HOURS'; end if;
	select operating_hours into v_hours from stores where id = p_id;
	v_sched := coalesce(v_hours ->> 'enabled' = 'true', false);

	if not v_sched then
		v_until := null;
	else
		v_sched_open := public.store_schedule_open(v_hours, v_at);
		if p_open = v_sched_open then
			-- Already what the schedule says: just follow it
			update store_open_control set override = null, override_until = null, override_by = null, override_by_name = '', override_at = null where store_id = p_id;
			return null;
		elsif p_open then
			v_until := v_at + make_interval(hours => coalesce(p_extra_hours, 4));
		else
			v_until := public.store_schedule_next(v_hours, v_at);
		end if;
	end if;

	update store_open_control
	set override = case when p_open then 'OPEN' else 'CLOSED' end, override_until = v_until,
		override_by = p_by, override_by_name = public.store_actor_name(), override_at = v_at
	where store_id = p_id;
	return v_until;
end $$;

-- ===== The owner =====

drop function if exists public.partner_set_store_open(boolean);
create or replace function public.partner_set_store_open(p_open boolean, p_hours int default null, p_rev int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
	v_store text := partner_store();
	c store_open_control;
	s stores%rowtype;
	v_until timestamptz;
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	c := public.store_open_touch(v_store, p_rev);
	select * into s from stores where id = v_store;
	if c.locked and (c.lock_until is null or c.lock_until > now()) then raise exception 'STORE_LOCKED'; end if;
	if s.hidden and coalesce(p_open, false) then raise exception 'STORE_PENDING_REVIEW'; end if;

	v_until := public.store_apply_override(v_store, coalesce(p_open, false), p_hours, 'OWNER');
	update store_open_control set rev = rev + 1, updated_at = now() where store_id = v_store;
	perform public.refresh_store_open(v_store);
	perform log_admin(case when p_open then 'STORE_OPENED' else 'STORE_CLOSED' end, 'store', v_store, s.name,
		jsonb_build_object('by', 'partner', 'until', v_until));
	return public.store_open_status(v_store) #- '{lock,by}';
end $$;

-- Back to opening and closing by the schedule (drops the owner's / team's open-or-closed override)
create or replace function public.partner_follow_schedule(p_rev int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_store text := partner_store(); c store_open_control; v_name text;
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	c := public.store_open_touch(v_store, p_rev);
	select name into v_name from stores where id = v_store;
	if (select operating_hours ->> 'enabled' from stores where id = v_store) is distinct from 'true' then raise exception 'NO_SCHEDULE'; end if;
	update store_open_control set override = null, override_until = null, override_by = null, override_by_name = '', override_at = null,
		rev = rev + 1, updated_at = now() where store_id = v_store;
	perform public.refresh_store_open(v_store);
	perform log_admin('STORE_FOLLOW_SCHEDULE', 'store', v_store, v_name, '{"by": "partner"}');
	return public.store_open_status(v_store) #- '{lock,by}';
end $$;

/**
 * Save the weekly schedule. Turning it on hands the store to the clock (a hand override is dropped);
 * turning it off freezes the state the store is in right now, so nothing flips by surprise.
 */
create or replace function public.store_save_hours(p_id text, p_hours jsonb, p_rev int, p_by text) returns void
language plpgsql security definer set search_path = public as $$
declare
	c store_open_control;
	s stores%rowtype;
	v_new jsonb := public.store_hours_normalize(p_hours);
	v_was boolean;
	v_open_now boolean;
begin
	c := public.store_open_touch(p_id, p_rev);
	select * into s from stores where id = p_id;
	v_was := coalesce(s.operating_hours ->> 'enabled' = 'true', false);
	v_open_now := public.store_open_now(p_id);

	update stores set operating_hours = v_new where id = p_id;
	if v_new ->> 'enabled' = 'true' then
		update store_open_control set override = null, override_until = null, override_by = null, override_by_name = '', override_at = null where store_id = p_id;
	elsif v_was then
		update store_open_control
		set override = case when v_open_now then 'OPEN' else 'CLOSED' end, override_until = null,
			override_by = p_by, override_by_name = public.store_actor_name(), override_at = now()
		where store_id = p_id and not (locked and (lock_until is null or lock_until > now()));
	end if;
	update store_open_control set rev = rev + 1, updated_at = now() where store_id = p_id;
	perform public.refresh_store_open(p_id);
	perform log_admin('STORE_OPERATING_HOURS_UPDATED', 'store', p_id, s.name,
		jsonb_build_object('hours', v_new, 'by', case p_by when 'OWNER' then 'partner' else 'team' end));
end $$;

drop function if exists public.partner_set_operating_hours(jsonb);
create or replace function public.partner_set_operating_hours(p_hours jsonb, p_rev int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_store text := partner_store();
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	perform public.store_save_hours(v_store, p_hours, p_rev, 'OWNER');
	return public.store_open_status(v_store) #- '{lock,by}';
end $$;

create or replace function public.partner_store_open_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_store text := partner_store();
begin
	if v_store is null then raise exception 'PARTNER_ONLY'; end if;
	return public.store_open_status(v_store) #- '{lock,by}';
end $$;

-- ===== The team =====

-- Closing = a team LOCK (the owner's page can't undo it); opening clears the lock and opens the store
drop function if exists public.admin_set_store_open(text, boolean);
create or replace function public.admin_set_store_open(
	p_store_id text, p_open boolean, p_reason text default null, p_until timestamptz default null,
	p_hours int default null, p_rev int default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
	c store_open_control;
	s stores%rowtype;
	v_reason text := left(trim(coalesce(p_reason, '')), 200);
	v_until timestamptz;
begin
	perform require_team();
	c := public.store_open_touch(p_store_id, p_rev);
	select * into s from stores where id = p_store_id;

	if not coalesce(p_open, false) then
		if p_until is not null and p_until <= now() then raise exception 'BAD_UNTIL'; end if;
		-- A store with no schedule and no hand switch is "as it is": remember that, so it comes back as it was when the lock ends
		if coalesce(s.operating_hours ->> 'enabled', '') <> 'true' and not (c.override is not null and (c.override_until is null or c.override_until > now())) then
			update store_open_control
			set override = case when public.store_open_now(p_store_id) then 'OPEN' else 'CLOSED' end, override_until = null,
				override_by = 'OWNER', override_by_name = '', override_at = now()
			where store_id = p_store_id;
		end if;
		update store_open_control
		set locked = true, lock_reason = v_reason, lock_by = public.store_actor_name(), lock_at = now(), lock_until = p_until,
			rev = rev + 1, updated_at = now()
		where store_id = p_store_id;
		perform public.refresh_store_open(p_store_id);
		perform log_admin('STORE_LOCKED', 'store', p_store_id, s.name, jsonb_build_object('reason', v_reason, 'until', p_until));
	else
		if s.hidden then raise exception 'STORE_HIDDEN'; end if;
		update store_open_control set locked = false, lock_reason = '', lock_by = '', lock_at = null, lock_until = null where store_id = p_store_id;
		v_until := public.store_apply_override(p_store_id, true, p_hours, 'TEAM');
		update store_open_control set rev = rev + 1, updated_at = now() where store_id = p_store_id;
		perform public.refresh_store_open(p_store_id);
		perform log_admin('STORE_OPENED', 'store', p_store_id, s.name, jsonb_build_object('by', 'team', 'until', v_until));
	end if;
	return public.store_open_status(p_store_id);
end $$;

-- Let the store run itself again: drop the lock, and (if asked and there is a schedule) the override too
create or replace function public.admin_release_store_open(p_store_id text, p_follow_schedule boolean default false, p_rev int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c store_open_control; s stores%rowtype;
begin
	perform require_team();
	c := public.store_open_touch(p_store_id, p_rev);
	select * into s from stores where id = p_store_id;
	update store_open_control set locked = false, lock_reason = '', lock_by = '', lock_at = null, lock_until = null where store_id = p_store_id;
	if p_follow_schedule and s.operating_hours ->> 'enabled' = 'true' then
		update store_open_control set override = null, override_until = null, override_by = null, override_by_name = '', override_at = null where store_id = p_store_id;
	end if;
	update store_open_control set rev = rev + 1, updated_at = now() where store_id = p_store_id;
	perform public.refresh_store_open(p_store_id);
	perform log_admin('STORE_UNLOCKED', 'store', p_store_id, s.name, jsonb_build_object('follow_schedule', coalesce(p_follow_schedule, false)));
	return public.store_open_status(p_store_id);
end $$;

create or replace function public.admin_set_store_hours(p_store_id text, p_hours jsonb, p_rev int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
	perform require_team();
	perform public.store_save_hours(p_store_id, p_hours, p_rev, 'TEAM');
	return public.store_open_status(p_store_id);
end $$;

create or replace function public.admin_store_open_status(p_store_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return public.store_open_status(p_store_id);
end $$;

-- One line per store for the console list
create or replace function public.admin_store_open_states() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(jsonb_build_object(
			'store_id', s.id,
			'source', st ->> 'source',
			'lock_reason', st -> 'lock' ->> 'reason',
			'lock_until', st -> 'lock' ->> 'until',
			'override', st -> 'override' ->> 'value',
			'override_by', st -> 'override' ->> 'by',
			'override_until', st -> 'override' ->> 'until',
			'schedule_enabled', s.operating_hours ->> 'enabled' = 'true',
			'next_change', st ->> 'next_change'
		)), '[]'::jsonb)
		from stores s, lateral (select public.store_open_status(s.id) as st) q
		where s.deleted_at is null
	);
end $$;

-- ---------- Orders ask the decision fresh, not the stored copy ----------
create or replace function public.place_order_core(
	p_store_id text,
	p_items jsonb,
	p_dropoff text,
	p_note text,
	p_payment public.payment_method,
	p_promo_code text,
	p_fee int
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
	v_uid uuid := auth.uid();
	v_store stores%rowtype;
	v_food int := 0;
	v_qty int := 0;
	v_fee int := p_fee;
	v_details text;
	v_best promotions%rowtype;
	v_partner int := 0;
	v_effective_fee int;
	v_code text := nullif(upper(trim(coalesce(p_promo_code, ''))), '');
	v_promo promo_codes%rowtype;
	v_code_discount int := 0;
	v_order_id uuid;
	v_lines jsonb;
begin
	if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

	-- Block placing order / generating payment QR when no riders are ready
	if not payment_test_mode() and coalesce(riders_online(), 0) = 0 then
		raise exception 'NO_RIDERS_ONLINE';
	end if;

	select * into v_store from stores where id = p_store_id;
	if v_store.id is null or not public.store_open_now(v_store.id) then raise exception 'STORE_UNAVAILABLE'; end if;
	if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;

	-- Resolve every line against live menu; prices include selected options
	select jsonb_agg(jsonb_build_object(
		'id', m.id,
		'special', l.special,
		'selected_options', l.selected_options,
		'name', m.name || case when l.special then ' (พิเศษ)' else '' end || case when l.opt_summary <> '' then ' (+' || l.opt_summary || ')' else '' end,
		'price', (case when l.special then m.special_price else m.price end) + l.opt_extra,
		'quantity', l.quantity
	))
	into v_lines
	from (
		select i ->> 'menu_item_id' as menu_item_id,
			coalesce((i ->> 'special')::boolean, false) as special,
			(i ->> 'quantity')::int as quantity,
			coalesce(i -> 'selected_options', '[]'::jsonb) as selected_options,
			coalesce((
				select sum(case when (opt ->> 'price')::int > 0 then (opt ->> 'price')::int else 0 end)::int
				from jsonb_array_elements(coalesce(i -> 'selected_options', '[]'::jsonb)) opt
			), 0) as opt_extra,
			coalesce((
				select string_agg(opt ->> 'name', ', ')
				from jsonb_array_elements(coalesce(i -> 'selected_options', '[]'::jsonb)) opt
			), '') as opt_summary
		from jsonb_array_elements(p_items) i
	) l
	join menu_items m on m.id = l.menu_item_id and m.store_id = p_store_id and m.is_available
		and (not l.special or m.special_price is not null);

	if coalesce(jsonb_array_length(v_lines), 0) <> jsonb_array_length(p_items) then
		raise exception 'ITEM_UNAVAILABLE';
	end if;
	if exists (select 1 from jsonb_to_recordset(v_lines) as l(quantity int) where l.quantity not between 1 and 50) then
		raise exception 'BAD_QUANTITY';
	end if;

	select sum(l.price * l.quantity), sum(l.quantity), string_agg(l.name || ' ×' || l.quantity, ', ')
	into v_food, v_qty, v_details
	from jsonb_to_recordset(v_lines) as l(id text, name text, price int, quantity int);

	-- Best live promotion for this cart
	select * into v_best from promotions
	where store_id = p_store_id and active and approved and min_qty <= v_qty
		and (ends_at is null or ends_at > now())
	order by discount + case when free_delivery then v_fee else 0 end desc, created_at
	limit 1;
	if v_best.id is not null then
		v_partner := v_best.discount + case when v_best.free_delivery then v_fee else 0 end;
	end if;
	v_effective_fee := case when v_best.free_delivery then 0 else v_fee end;

	-- An app discount code: 1 ฿ off (or free delivery), created and scheduled from the console
	if v_code is not null then
		select * into v_promo from promo_codes where code = v_code for update;
		if v_promo.code is null or not v_promo.active then raise exception 'PROMO_INVALID'; end if;
		if v_promo.starts_at > now() then raise exception 'PROMO_NOT_STARTED'; end if;
		if (select count(*) from orders where promo_code = v_code and status <> 'CANCELLED') >= v_promo.max_uses then
			raise exception 'PROMO_USES_UP';
		end if;
		v_code_discount := case when v_promo.kind = 'FREE_DELIVERY' then v_effective_fee else v_promo.amount end;
	end if;

	insert into orders (
		order_code, kind, customer_id, store_id, pickup_name, dropoff_name, item_details,
		food_total, delivery_fee, code_discount, partner_discount, promo_code, promotion_id,
		total_price, payment_method, note
	) values (
		new_order_code(), 'STORE', v_uid, p_store_id, v_store.name, p_dropoff, v_details,
		v_food, v_fee, v_code_discount, v_partner, v_code, v_best.id,
		greatest(0, v_food + v_fee - v_code_discount - v_partner), p_payment, nullif(trim(p_note), '')
	) returning id into v_order_id;

	insert into order_items (order_id, menu_item_id, special, name, price, quantity, selected_options)
	select v_order_id, l.id, l.special, l.name, l.price, l.quantity, coalesce(l.selected_options, '[]'::jsonb)
	from jsonb_to_recordset(v_lines) as l(id text, special boolean, name text, price int, quantity int, selected_options jsonb);

	insert into order_secrets (order_id, otp_code)
	values (v_order_id, lpad((floor(random() * 10000))::int::text, 4, '0'));
	insert into chat_messages (order_id, sender_role, body)
	values (v_order_id, 'SYSTEM', 'สร้างออเดอร์แล้ว กำลังหาเพื่อนรับหิ้ว');
	return v_order_id;
end $$;

-- ---------- Existing stores keep exactly the state they have right now ----------

insert into public.store_open_control (store_id, override, override_until, override_by, override_by_name, override_at)
select s.id,
	case
		when s.operating_hours ->> 'enabled' = 'true' then
			case when s.is_open is distinct from public.store_schedule_open(s.operating_hours) then case when s.is_open then 'OPEN' else 'CLOSED' end end
		else case when s.is_open then 'OPEN' else 'CLOSED' end
	end,
	case when s.operating_hours ->> 'enabled' = 'true' and s.is_open is distinct from public.store_schedule_open(s.operating_hours)
		then public.store_schedule_next(s.operating_hours) end,
	'OWNER', '', now()
from public.stores s
on conflict (store_id) do nothing;
-- a row with no override is just "follow the schedule"
update public.store_open_control set override_by = null, override_at = null where override is null;

-- ---------- Everyone sees changes as they happen ----------

do $$ begin
	alter publication supabase_realtime add table public.stores;
exception when duplicate_object then null;
	when undefined_object then raise notice 'no supabase_realtime publication here';
end $$;

-- ---------- The clock: re-evaluate every store twice a minute ----------

do $$ begin
	begin
		perform cron.schedule('store-open-sync', '30 seconds', 'select public.refresh_all_store_open()');
	exception when others then
		perform cron.schedule('store-open-sync', '* * * * *', 'select public.refresh_all_store_open()');
	end;
exception when others then
	raise notice 'pg_cron not available: stores are re-evaluated when written and when an order is placed';
end $$;
select public.refresh_all_store_open();

-- ---------- Who may call what ----------

revoke execute on function
	public.store_schedule_open(jsonb, timestamptz), public.store_schedule_next(jsonb, timestamptz), public.store_hours_normalize(jsonb),
	public.store_open_calc(text, boolean, timestamptz, jsonb, boolean, timestamptz), public.store_open_now(text, timestamptz),
	public.refresh_store_open(text), public.refresh_all_store_open(), public.stores_apply_open_state(),
	public.store_open_status(text), public.store_open_touch(text, int), public.store_actor_name(),
	public.store_apply_override(text, boolean, int, text), public.store_save_hours(text, jsonb, int, text)
from anon, authenticated, public;

revoke execute on function
	public.partner_set_store_open(boolean, int, int), public.partner_follow_schedule(int),
	public.partner_set_operating_hours(jsonb, int), public.partner_store_open_status(),
	public.admin_set_store_open(text, boolean, text, timestamptz, int, int), public.admin_release_store_open(text, boolean, int),
	public.admin_set_store_hours(text, jsonb, int), public.admin_store_open_status(text), public.admin_store_open_states()
from anon, public;
grant execute on function
	public.partner_set_store_open(boolean, int, int), public.partner_follow_schedule(int),
	public.partner_set_operating_hours(jsonb, int), public.partner_store_open_status(),
	public.admin_set_store_open(text, boolean, text, timestamptz, int, int), public.admin_release_store_open(text, boolean, int),
	public.admin_set_store_hours(text, jsonb, int), public.admin_store_open_status(text), public.admin_store_open_states()
to authenticated;
