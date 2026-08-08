-- 013_retire_legacy_tables.sql
-- Liten & Co — moves the pre-owner_key generation out of the way.
--
-- Verified 2026-08-08:
--   jobs          41 rows · last write 2026-03-21
--   users          1 row  · last write 2026-03-18
--   orders         0 rows · never written
--   renders        0 rows · never written
--   queued_jobs    0 rows · never written
--   magic_tokens   0 rows · never written
--
-- Nothing is dropped. Renaming keeps the data and guarantees that any
-- forgotten query against these names fails loudly instead of silently
-- returning stale rows — which is the actual risk (revenue double-counting
-- across `orders` + `purchases`, two credit balances across `users` +
-- `credit_balances`).
--
-- Foreign keys follow the rename automatically; no FK work required.
--
-- REVERSIBLE: rename back if anything breaks.

begin;

do $$ begin alter table public.jobs         rename to zz_legacy_jobs;         exception when undefined_table then null; end $$;
do $$ begin alter table public.orders       rename to zz_legacy_orders;       exception when undefined_table then null; end $$;
do $$ begin alter table public.users        rename to zz_legacy_users;        exception when undefined_table then null; end $$;
do $$ begin alter table public.renders      rename to zz_legacy_renders;      exception when undefined_table then null; end $$;
do $$ begin alter table public.queued_jobs  rename to zz_legacy_queued_jobs;  exception when undefined_table then null; end $$;
do $$ begin alter table public.magic_tokens rename to zz_legacy_magic_tokens; exception when undefined_table then null; end $$;

comment on table public.zz_legacy_jobs         is 'RETIRED 2026-08-08 — DALL-E/jobs generation. Do not query.';
comment on table public.zz_legacy_orders       is 'RETIRED 2026-08-08 — superseded by purchases. Do not query.';
comment on table public.zz_legacy_users        is 'RETIRED 2026-08-08 — superseded by auth.users + credit_balances. Do not query.';
comment on table public.zz_legacy_renders      is 'RETIRED 2026-08-08 — DALL-E prompt lab. Do not query.';
comment on table public.zz_legacy_queued_jobs  is 'RETIRED 2026-08-08 — never wired. Do not query.';
comment on table public.zz_legacy_magic_tokens is 'RETIRED 2026-08-08 — superseded by Supabase auth. Do not query.';

commit;
