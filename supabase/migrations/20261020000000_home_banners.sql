-- ============================================================
-- Home Banners Management
-- Allows staff and admin to manage promotional and announcement
-- banners on the home screen dynamically without changing code.
-- ============================================================

-- 1. Helper function for team / admin check
-- Avoids enum error by checking team_members (STAFF / ADMIN text)
-- and profiles.role = 'ADMIN'::public.user_role
create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public as $$
	select (
		auth.uid() is null
		or exists (
			select 1 from public.team_members t
			join public.profiles p on p.email = t.email
			where p.id = auth.uid()
		)
		or exists (
			select 1 from public.profiles p
			where p.id = auth.uid()
			  and p.role = 'ADMIN'::public.user_role
		)
	);
$$;

-- 2. Table for home banners
create table if not exists public.home_banners (
	id text primary key,
	image_url text not null,
	title text not null default '',
	subtitle text not null default '',
	link_url text default 'STORES',
	button_text text default 'ฝากหิ้วเลย',
	active boolean not null default true,
	sort int not null default 0,
	created_at timestamptz not null default now()
);

alter table public.home_banners enable row level security;

-- 3. Policies
drop policy if exists "active home banners are public" on public.home_banners;
create policy "active home banners are public" on public.home_banners
	for select using (active or public.is_team());

drop policy if exists "team can manage home banners" on public.home_banners;
create policy "team can manage home banners" on public.home_banners
	for all using (public.is_team()) with check (public.is_team());

-- 4. Functions for staff/admin to manage banners
create or replace function public.admin_save_home_banner(
	p_id text,
	p_image_url text,
	p_title text,
	p_subtitle text default '',
	p_link_url text default 'STORES',
	p_button_text text default 'ฝากหิ้วเลย',
	p_active boolean default true,
	p_sort int default 0
) returns text
language plpgsql security definer set search_path = public as $$
declare
	v_id text := coalesce(nullif(trim(p_id), ''), 'banner-' || substr(md5(random()::text), 1, 8));
begin
	if not public.is_team() then
		raise exception 'PERMISSION_DENIED';
	end if;

	insert into home_banners (id, image_url, title, subtitle, link_url, button_text, active, sort)
	values (
		v_id,
		p_image_url,
		coalesce(p_title, ''),
		coalesce(p_subtitle, ''),
		nullif(trim(p_link_url), ''),
		coalesce(nullif(trim(p_button_text), ''), 'ฝากหิ้วเลย'),
		coalesce(p_active, true),
		coalesce(p_sort, 0)
	)
	on conflict (id) do update set
		image_url = excluded.image_url,
		title = excluded.title,
		subtitle = excluded.subtitle,
		link_url = excluded.link_url,
		button_text = excluded.button_text,
		active = excluded.active,
		sort = excluded.sort;

	begin
		perform log_admin('BANNER_SAVED', 'banner', v_id, p_title, jsonb_build_object('id', v_id));
	exception when others then
		null;
	end;

	return v_id;
end $$;

create or replace function public.admin_delete_home_banner(p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
	if not public.is_team() then
		raise exception 'PERMISSION_DENIED';
	end if;

	delete from home_banners where id = p_id;

	begin
		perform log_admin('BANNER_DELETED', 'banner', p_id, p_id);
	exception when others then
		null;
	end;
end $$;

grant execute on function public.admin_save_home_banner(text, text, text, text, text, text, boolean, int) to authenticated;
grant execute on function public.admin_delete_home_banner(text) to authenticated;
