-- ============================================================
-- The error log cannot be filled up from outside
--
-- log_client_error() is open to anyone (the app reports its own crashes, signed in or not).
-- It already limited new errors to 30 a minute, but that still lets someone push in about
-- 40,000 rows a day of up to 4 KB each, and push real errors out of the window. Now the table
-- holds at most 2,000 distinct open errors; beyond that only counts of known errors go up.
-- ============================================================
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
	-- And never more than 2,000 rows, however fast they arrive
	if (select count(*) from client_errors) >= 2000 then return; end if;

	insert into client_errors (fingerprint, app, kind, message, stack, source, url, user_agent, release, user_id)
	values (v_fp, v_app, v_kind, v_message, left(coalesce(p_stack, ''), 4000), v_source,
		left(coalesce(p_url, ''), 500), left(coalesce(p_user_agent, ''), 300), left(coalesce(p_release, ''), 40), auth.uid());
exception when unique_violation then
	update client_errors set count = count + 1, last_at = now() where fingerprint = v_fp and resolved_at is null;
end $$;
