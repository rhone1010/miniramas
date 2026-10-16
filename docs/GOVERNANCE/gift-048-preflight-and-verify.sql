-- gift-048-preflight-and-verify.sql
--
-- READ-ONLY. Run in the Supabase SQL editor (project dqctwzertbujhsjatfyv, shared by Preview and Production).
-- PART A before applying supabase/migrations/048_gift_orders.sql (047 must already be applied); PART B after.
-- Migration 048 depends on live tables that are not defined in this repository's migrations (portfolios, portfolio_items,
-- preview_ledger, print_orders columns), so Part A checks that every column it writes or reads exists.

-- ═══ PART A: preflight (every row should say PASS) ═════════════════════════════════════════════════════════════════
with need(tbl, col) as (values
  ('print_orders', 'id'), ('print_orders', 'status'), ('print_orders', 'stripe_session_id'), ('print_orders', 'stripe_payment_intent'),
  ('print_orders', 'paid_at'), ('print_orders', 'placed_at'), ('print_orders', 'prodigi_order_id'), ('print_orders', 'updated_at'),
  ('print_orders', 'retail_total_cents'), ('print_orders', 'retail_shipping_cents'), ('print_orders', 'customer_email'), ('print_orders', 'items'),
  ('portfolios', 'id'), ('portfolios', 'purchase_id'), ('portfolios', 'user_id'), ('portfolios', 'series'), ('portfolios', 'size'), ('portfolios', 'status'),
  ('portfolios', 'free_unlocks'), ('portfolios', 'source_image'), ('portfolios', 'composition'), ('portfolios', 'delivery'), ('portfolios', 'pose'),
  ('portfolios', 'framing'), ('portfolios', 'subject'), ('portfolios', 'aspect_ratio'), ('portfolios', 'origin'),
  ('portfolio_items', 'portfolio_id'), ('portfolio_items', 'slot'), ('portfolio_items', 'preset'), ('portfolio_items', 'status'), ('portfolio_items', 'preview_id'),
  ('preview_ledger', 'id'), ('preview_ledger', 'email'), ('preview_ledger', 'ip_hash'), ('preview_ledger', 'series'), ('preview_ledger', 'preset'),
  ('preview_ledger', 'resolution'), ('preview_ledger', 'storage_path'), ('preview_ledger', 'unlocked_at'),
  ('print_asset_jobs', 'source_kind'))
select 'live column ' || n.tbl || '.' || n.col as check,
       case when exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = n.tbl and c.column_name = n.col) then 'PASS' else 'FAIL: missing' end as result
  from need n
union all
select 'migration 047 applied', case when to_regclass('public.gift_sessions') is not null and to_regclass('public.gift_preview_packs') is not null then 'PASS' else 'FAIL: apply 047 first' end
union all
select 'no 048 objects yet', case when to_regclass('public.gift_order_lines') is null and to_regclass('public.gift_compositions') is null and to_regclass('public.gift_refunds') is null then 'PASS' else 'NOTE: some 048 objects already exist' end
union all
select 'print_order_status has no awaiting_artwork yet', case when exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'print_order_status' and e.enumlabel = 'awaiting_artwork') then 'NOTE: already added' else 'PASS' end
union all
select 'portfolios_origin_purchase_check exists (048 replaces it with a superset)', case when exists (select 1 from pg_constraint where conname = 'portfolios_origin_purchase_check') then 'PASS' else 'NOTE: not present; 048 adds it' end
union all
select 'no existing portfolio violates the new origin check',
       case when not exists (select 1 from public.portfolios where not (
         (origin = 'discovery' and purchase_id is not null)
         or (origin = 'foyer' and purchase_id is null and series in ('portraits', 'pets') and size = 1 and delivery = 'preview' and free_unlocks = 0)
         or (origin = 'gift' and purchase_id is null and series in ('portraits', 'pets', 'groups') and size = 1 and delivery = 'preview' and free_unlocks = 0))) then 'PASS' else 'FAIL: a portfolio would violate the new check' end;

-- Review these two definitions: 048 replaces both with supersets.
select conname as constraint_name, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conname in ('portfolios_origin_purchase_check') or (conrelid = 'public.print_asset_jobs'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%source_kind%');

-- Is portfolios.source_image nullable? (048 passes the customer's source photograph; if it is NOT NULL this is fine.)
select column_name, is_nullable, data_type from information_schema.columns where table_schema = 'public' and table_name = 'portfolios' and column_name = 'source_image';

-- ═══ PART B: after applying 048 (every row should say PASS) ═══════════════════════════════════════════════════════
select 'new tables exist with RLS on' as check,
       case when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname in ('gift_order_lines', 'gift_compositions', 'gift_refund_requests', 'gift_refunds') and c.relrowsecurity) = 4
            then 'PASS' else 'FAIL' end as result
union all
select 'awaiting_artwork added to print_order_status', case when exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'print_order_status' and e.enumlabel = 'awaiting_artwork') then 'PASS' else 'FAIL' end
union all
select 'print jobs accept the gift source', case when exists (select 1 from pg_constraint where conrelid = 'public.print_asset_jobs'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%gift%') then 'PASS' else 'FAIL' end
union all
select 'My Collection accepts origin gift', case when exists (select 1 from pg_constraint where conname = 'portfolios_origin_purchase_check' and pg_get_constraintdef(oid) ilike '%gift%') then 'PASS' else 'FAIL' end
union all
select 'service_role can execute every gift function',
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname like 'gift\_%' and has_function_privilege('service_role', p.oid, 'execute')) =
                 (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'gift\_%')
            then 'PASS' else 'FAIL: re-run the grants at the end of 048' end
union all
select 'anon and authenticated can execute no gift function',
       case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.proname like 'gift\_%'
                                and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')))
            then 'PASS' else 'FAIL: a browser role can execute a gift function' end
union all
select 'anon and authenticated have no gift table access',
       case when not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name like 'gift\_%' and grantee in ('anon', 'authenticated'))
            then 'PASS' else 'FAIL: a browser role has a table grant' end;
