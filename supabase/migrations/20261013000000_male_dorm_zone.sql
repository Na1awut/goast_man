-- ============================================================
-- โรงอาหารหอชาย: the male dorm canteen (next to S5) as a store zone
--
-- Its stalls (supabase/data/male_dorm_stores.sql) get ids male-dorm-NN,
-- the same pattern admin_create_store uses for new stores in this zone.
-- ============================================================

alter type public.store_zone add value if not exists 'male-dorm';
