-- ============================================================
-- Error log: errors from the web app (buyer app and team console) land here,
-- and the team reads them on the console's "ข้อผิดพลาด" page.
--
-- The same error is one row with a count, not one row per occurrence, so a
-- crash at lunch shows as "×40" instead of burying everything else. Marking it
-- fixed closes the row; if it comes back after that, a new row opens.
-- ============================================================

create table public.client_errors (
	id bigint generated always as identity primary key,
	fingerprint text not null,
	app text not null check (app in ('buyer', 'console')),
	kind text not null check (kind in ('error', 'rejection', 'svelte')),
	message text not null,
	stack text not null default '',
	source text not null default '',
	url text not null default '',
	user_agent text not null default '',
	release text not null default '',
	-- Last signed-in user who hit it (null = signed out)
	user_id uuid references auth.users on delete set null,
	first_at timestamptz not null default now(),
	last_at timestamptz not null default now(),
	count int not null default 1,
	resolved_at timestamptz,
	resolved_by uuid references auth.users on delete set null
);
alter table public.client_errors enable row level security; -- no policies: functions only
create unique index client_errors_open on public.client_errors (fingerprint) where resolved_at is null;
create index client_errors_last on public.client_errors (last_at desc);

-- Called by the app for every uncaught error. Anyone may call it (errors happen
-- before sign-in too), so everything is trimmed and new rows are capped.
create or replace function public.log_client_error(
	p_app text, p_kind text, p_message text, p_stack text default '', p_source text default '',
	p_url text default '', p_user_agent text default '', p_release text default ''
) returns void
language plpgsql security definer set search_path = public as $$
declare
	v_app text := case when p_app = 'console' then 'console' else 'buyer' end;
	v_kind text := case when p_kind in ('rejection', 'svelte') then p_kind else 'error' end;
	v_message text := left(coalesce(nullif(trim(p_message), ''), '(no message)'), 500);
	v_source text := left(coalesce(p_source, ''), 300);
	v_fp text := md5(v_app || '|' || v_kind || '|' || v_message || '|' || v_source);
begin
	update client_errors
	set count = count + 1, last_at = now(), url = left(coalesce(p_url, ''), 500),
		user_agent = left(coalesce(p_user_agent, ''), 300), user_id = coalesce(auth.uid(), user_id)
	where fingerprint = v_fp and resolved_at is null;
	if found then return; end if;

	-- A flood of new, different errors (a bug loop or abuse) must not fill the table
	if (select count(*) from client_errors where first_at > now() - interval '1 minute') >= 30 then return; end if;
	-- Keep a month
	delete from client_errors where last_at < now() - interval '30 days';

	insert into client_errors (fingerprint, app, kind, message, stack, source, url, user_agent, release, user_id)
	values (v_fp, v_app, v_kind, v_message, left(coalesce(p_stack, ''), 4000), v_source,
		left(coalesce(p_url, ''), 500), left(coalesce(p_user_agent, ''), 300), left(coalesce(p_release, ''), 40), auth.uid());
exception when unique_violation then
	-- Two reports of a new error at the same moment: the other one inserted it
	update client_errors set count = count + 1, last_at = now() where fingerprint = v_fp and resolved_at is null;
end $$;

-- p_status: 'open' (newest first) or 'resolved'
create or replace function public.admin_errors(p_status text default 'open', p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (
		select coalesce(jsonb_agg(jsonb_build_object(
			'id', e.id, 'app', e.app, 'kind', e.kind, 'message', e.message, 'stack', e.stack, 'source', e.source,
			'url', e.url, 'user_agent', e.user_agent, 'release', e.release,
			'user', coalesce(nullif(u.nickname, ''), u.email),
			'first_at', e.first_at, 'last_at', e.last_at, 'count', e.count,
			'resolved_at', e.resolved_at, 'resolved_by', coalesce(nullif(r.nickname, ''), r.email)
		) order by coalesce(e.resolved_at, e.last_at) desc), '[]'::jsonb)
		from (
			select * from client_errors
			where (p_status = 'resolved') = (resolved_at is not null)
			order by coalesce(resolved_at, last_at) desc limit greatest(1, least(p_limit, 300))
		) e
		left join profiles u on u.id = e.user_id
		left join profiles r on r.id = e.resolved_by
	);
end $$;

-- Open errors seen in the last 24 hours: the console's menu badge
create or replace function public.admin_error_count() returns int
language plpgsql stable security definer set search_path = public as $$
begin
	perform require_team();
	return (select count(*) from client_errors where resolved_at is null and last_at > now() - interval '24 hours');
end $$;

create or replace function public.admin_resolve_error(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_message text;
begin
	perform require_team();
	update client_errors set resolved_at = now(), resolved_by = auth.uid()
	where id = p_id and resolved_at is null
	returning message into v_message;
	if v_message is null then raise exception 'BAD_STATE'; end if;
	perform log_admin('ERROR_RESOLVED', 'error', p_id::text, left(v_message, 80));
end $$;

grant execute on function public.log_client_error(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_errors(text, int), public.admin_error_count(), public.admin_resolve_error(bigint) to authenticated;
revoke execute on function public.admin_errors(text, int), public.admin_error_count(), public.admin_resolve_error(bigint) from anon, public;
