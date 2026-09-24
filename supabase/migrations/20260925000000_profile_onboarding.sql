-- ============================================================
-- First-run profile (onboarding) + PDPA consent
--
-- New accounts arrive from Google with only an email and a name. Before
-- using the app they complete their profile and accept the current terms.
-- Profile edits go through complete_profile(), which validates on the
-- server, so the direct column grants from the init migration are removed.
-- ============================================================

alter table public.profiles
	add column study_level text check (study_level in ('1', '2', '3', '4', '5', '6', '7', '8', 'grad', 'staff')),
	add column terms_version text,
	add column consented_at timestamptz;

-- One account per student ID
create unique index profiles_student_id_key on public.profiles (student_id) where student_id is not null;

-- All profile writes now go through complete_profile()
revoke update on public.profiles from authenticated, anon;
drop policy if exists "edit own profile" on public.profiles;

create or replace function public.complete_profile(
	p_nickname text,
	p_phone text,
	p_promptpay text,
	p_student_id text,
	p_faculty text,
	p_study_level text,
	p_terms_version text
) returns void
language plpgsql security definer set search_path = public as $$
declare
	v_role user_role;
	v_nickname text := trim(coalesce(p_nickname, ''));
	v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
	v_promptpay text := nullif(regexp_replace(coalesce(p_promptpay, ''), '\D', '', 'g'), '');
	v_student_id text := nullif(regexp_replace(coalesce(p_student_id, ''), '\D', '', 'g'), '');
	v_faculty text := nullif(trim(coalesce(p_faculty, '')), '');
	v_level text := nullif(trim(coalesce(p_study_level, '')), '');
begin
	select role into v_role from profiles where id = auth.uid();
	if v_role is null then raise exception 'AUTH_REQUIRED'; end if;

	if char_length(v_nickname) not between 1 and 30 then raise exception 'BAD_NICKNAME'; end if;
	if v_phone !~ '^0[689][0-9]{8}$' then raise exception 'BAD_PHONE'; end if;
	-- PromptPay: a mobile number or a 13-digit national ID
	if v_promptpay is not null and v_promptpay !~ '^(0[689][0-9]{8}|[0-9]{13})$' then raise exception 'BAD_PROMPTPAY'; end if;
	if nullif(trim(coalesce(p_terms_version, '')), '') is null then raise exception 'CONSENT_REQUIRED'; end if;

	if v_role = 'STUDENT' then
		if v_level is null then raise exception 'BAD_STUDY_LEVEL'; end if;
		if v_faculty is null or char_length(v_faculty) > 80 then raise exception 'BAD_FACULTY'; end if;
		-- Staff use their KMUTT account but have no student ID
		if v_level <> 'staff' and (v_student_id is null or v_student_id !~ '^[0-9]{8,13}$') then
			raise exception 'BAD_STUDENT_ID';
		end if;
		if v_level = 'staff' then v_student_id := null; end if;
	else
		-- Partner shop owners: contact details only
		v_student_id := null;
		v_faculty := null;
		v_level := null;
	end if;

	begin
		update profiles set
			nickname = v_nickname,
			phone = v_phone,
			promptpay_no = v_promptpay,
			student_id = v_student_id,
			faculty = v_faculty,
			study_level = v_level,
			terms_version = trim(p_terms_version),
			consented_at = now()
		where id = auth.uid();
	exception when unique_violation then
		raise exception 'STUDENT_ID_TAKEN';
	end;
end $$;

revoke execute on function public.complete_profile(text, text, text, text, text, text, text) from anon, public;
grant execute on function public.complete_profile(text, text, text, text, text, text, text) to authenticated;

-- Riders now show "คณะ · ปี N" on the buyer's tracking card
create or replace function public.level_label(p_level text) returns text
language sql immutable as $$
	select case
		when p_level is null then ''
		when p_level = 'grad' then 'บัณฑิตศึกษา'
		when p_level = 'staff' then 'บุคลากร'
		else 'ปี ' || p_level
	end
$$;
grant execute on function public.level_label(text) to authenticated;

create or replace function public.my_orders(p_order_id uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
	select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb)
	from (
		select o.*,
			case when o.status in ('ACCEPTED', 'DELIVERING') then s.otp_code end as otp_code,
			(
				select jsonb_agg(jsonb_build_object('menu_item_id', i.menu_item_id, 'name', i.name, 'price', i.price, 'quantity', i.quantity))
				from order_items i where i.order_id = o.id
			) as items,
			case when o.rider_id is not null then (
				select jsonb_build_object(
					'id', p.id, 'name', p.nickname, 'full_name', p.full_name,
					'faculty', trim(both ' ·' from concat_ws(' · ', nullif(p.faculty, ''), nullif(level_label(p.study_level), ''))),
					'phone', coalesce(p.phone, ''),
					'rating', coalesce((select round(avg(rating)::numeric, 2) from orders r where r.rider_id = p.id and r.rating is not null), 5),
					'jobs', (select count(*) from orders r where r.rider_id = p.id and r.status = 'COMPLETED')
				) from profiles p where p.id = o.rider_id
			) end as rider
		from orders o
		left join order_secrets s on s.order_id = o.id
		where o.customer_id = auth.uid() and (p_order_id is null or o.id = p_order_id)
	) x
$$;
