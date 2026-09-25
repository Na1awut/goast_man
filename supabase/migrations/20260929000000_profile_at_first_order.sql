-- ============================================================
-- Profile at the first order, not at sign-in
--
-- Students can now browse right after signing in; the app asks for their
-- details (nickname, phone, faculty, student ID + consent) the first time they
-- order or take a job. This makes the database hold the same line: nobody
-- places an order or takes a job without a complete profile, so the other side
-- always has a name and a phone number to reach them.
-- ============================================================

-- Same rule as needsOnboarding() in frontend/src/lib/profile.ts (minus the
-- terms version, which only the app knows)
create or replace function public.profile_ready(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
	select exists (
		select 1 from profiles p
		where p.id = p_uid
			and p.consented_at is not null
			and p.nickname <> ''
			and coalesce(p.phone, '') ~ '^0[689][0-9]{8}$'
			and (p.role <> 'STUDENT' or (
				p.study_level is not null and p.faculty is not null
				and (p.study_level = 'staff' or p.student_id is not null)
			))
	)
$$;
revoke execute on function public.profile_ready(uuid) from anon, public;

create or replace function public.require_ready_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	if tg_op = 'INSERT' and not profile_ready(new.customer_id) then
		raise exception 'PROFILE_REQUIRED';
	end if;
	if tg_op = 'UPDATE' and new.rider_id is not null and new.rider_id is distinct from old.rider_id
		and not profile_ready(new.rider_id) then
		raise exception 'PROFILE_REQUIRED';
	end if;
	return new;
end $$;

create trigger orders_require_ready_profile
	before insert or update of rider_id on public.orders
	for each row execute function public.require_ready_profile();
