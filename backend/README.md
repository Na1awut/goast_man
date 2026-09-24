# Superseded: kept for reference only

This Go/Fiber backend has been replaced by Supabase (see [`../supabase/README.md`](../supabase/README.md)).
Its rules (KMUTT-only sign-in, order state machine, atomic accept, OTP completion) now live in
`supabase/migrations/` as Postgres functions and Row-Level Security.
`docker-compose.yml` (local Postgres) is likewise no longer needed.
