-- gift-050-preflight-and-verify.sql
--
-- READ-ONLY. Run in the Supabase SQL editor as ONE statement: before applying supabase/migrations/050_gift_previews_before_purchase.sql (the first rows
-- PASS, the post-apply rows say "not yet"), then again after (every row PASS). 050 adds one table (gift_free_grants) and one function (gift_free_status),
-- and REPLACES gift_reserve_batch (the 5-argument version is dropped) and gift_select_artwork. It does not touch payment confirmation, packs, compositions,
-- corrections, approval or refunds.

select check_name, result, detail from (
  select 10 as ord, '047, 048 and 049 applied' as check_name,
         case when to_regclass('public.gift_batches') is not null and to_regclass('public.gift_compositions') is not null
                and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_compositions' and column_name = 'generation_mode')
              then 'PASS' else 'FAIL: apply 047, 048 and 049 first' end as result, '' as detail
  union all
  select 20, '050 state', 'NOTE', case when to_regclass('public.gift_free_grants') is not null then 'applied' else 'not applied yet' end
  union all
  select 30, 'free-grant ledger rows (they outlive sessions)', 'NOTE', case when to_regclass('public.gift_free_grants') is null then 'table missing' else (select count(*)::text || ' rows' from public.gift_free_grants) end
  union all
  select 40, 'gift_reserve_batch overloads (expected 1 AFTER 050: the 5-argument version is dropped)',
         case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'gift_reserve_batch') = 1
                   and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'gift_reserve_batch' and p.pronargs = 8)
              then 'PASS' else 'NOTE: not yet' end, ''
  union all
  select 50, 'function ' || f || ' exists (AFTER 050)',
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f) then 'PASS' else 'NOTE: not yet' end, ''
    from unnest(array['gift_free_status', 'gift_reserve_batch', 'gift_select_artwork']) as f
  union all
  select 60, 'batch kinds are still free or paid (050 adds no kind)',
         case when exists (select 1 from pg_constraint where conrelid = 'public.gift_batches'::regclass and pg_get_constraintdef(oid) like '%free%paid%') then 'PASS' else 'FAIL: unexpected kind constraint' end, ''
  union all
  select 70, 'browser roles cannot read or call anything new',
         case when to_regclass('public.gift_free_grants') is null then 'NOTE: not yet'
              when not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'gift_free_grants' and grantee in ('anon', 'authenticated'))
                   and not has_function_privilege('anon', 'public.gift_free_status(uuid, uuid, int, int, int, int)', 'execute')
                   and not has_function_privilege('authenticated', 'public.gift_reserve_batch(uuid, uuid, text, text[], int, int, int, int)', 'execute')
              then 'PASS' else 'FAIL: a browser role has access' end, ''
  union all
  select 80, 'print_orders by status (run before and after; the lists must be identical: 050 touches no order)', 'NOTE',
         coalesce((select string_agg(status::text || '=' || n::text, ', ' order by status::text) from (select status, count(*) as n from public.print_orders group by status) x), 'none')
  union all
  select 90, 'gift sessions, batches by kind, orders linked (run before and after; unchanged by 050)', 'NOTE',
         (select count(*)::text from public.gift_sessions) || ' sessions; batches: ' ||
         coalesce((select string_agg(kind || '=' || n::text, ', ' order by kind) from (select kind, count(*) as n from public.gift_batches group by kind) y), 'none') ||
         '; with order: ' || (select count(*)::text from public.gift_sessions where order_id is not null)
) t order by ord, check_name;
