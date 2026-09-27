-- ============================================================
-- Free delivery is Goose Man's money, not the store's
--
-- A free-delivery promotion means the buyer does not pay the delivery fee,
-- while the rider is still paid it by the team. So a store may no longer
-- switch it on by itself: a store's own deal (DEAL, live at once) cannot be
-- free delivery. A store can still ask for it inside a joint promotion
-- (CO_PROMO), which a team ADMIN approves first, and which goes back to
-- waiting whenever its terms change.
-- ============================================================

-- Existing store deals with free delivery become joint promotions waiting for the team
-- (run without a signed-in user, so the guard below trusts it)
update public.promotions set kind = 'CO_PROMO', approved = false where kind = 'DEAL' and free_delivery;

create or replace function public.guard_promotion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	-- No signed-in user = SQL editor, seed or service role: trust as admin
	if auth.uid() is null or public.team_role() = 'ADMIN' then
		return new;
	end if;
	if new.free_delivery and new.kind = 'DEAL' then
		raise exception 'FREE_DELIVERY_NEEDS_TEAM';
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
