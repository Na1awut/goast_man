-- Apply and commit before importing stores in this zone (Postgres enum rule).
alter type public.store_zone add value if not exists 'cb1';
