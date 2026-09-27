-- ============================================================
-- โรงอาหารหอหญิง: the female dorm canteen (next to S6) as a store zone
--
-- Its stalls (supabase/data/female_dorm_stores.sql) get ids female-dorm-NN,
-- the same pattern admin_create_store uses for new stores in this zone.
-- ============================================================

alter type public.store_zone add value if not exists 'female-dorm';
