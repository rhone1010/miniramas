-- render-recovery-053-preflight-and-verify.sql
--
-- READ-ONLY. Run as ONE statement before applying supabase/migrations/053_render_recovery.sql (the first rows PASS, the post-apply rows say "not yet"),
-- then again after (every row PASS). 053 adds three columns to portfolio_items, one table (render_recovery_ledger) and one function (claim_render_recovery).
-- It changes no existing function or row.

select check_name, result, detail from (
  select 10 as ord, 'portfolio_items, portfolios and purchases exist' as check_name,
         case when to_regclass('public.portfolio_items') is not null and to_regclass('public.portfolios') is not null and to_regclass('public.purchases') is not null
              then 'PASS' else 'FAIL: the Discovery tables are missing' end as result, '' as detail
  union all
  select 20, '053 state', 'NOTE', case when to_regclass('public.render_recovery_ledger') is not null then 'applied' else 'not applied yet' end
  union all
  select 30, 'portfolio_items has failed_at, recovery_count, recovered_at (AFTER 053)',
         case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portfolio_items' and column_name in ('failed_at', 'recovery_count', 'recovered_at')) = 3
              then 'PASS' else 'NOTE: not yet' end, ''
  union all
  select 40, 'no earlier failure is eligible: failed rows with a failure time (AFTER 053, must be 0 right after applying)',
         case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portfolio_items' and column_name = 'failed_at') = 0 then 'NOTE: not yet'
              else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.portfolio_items where status = ''failed'' and failed_at is not null', false, true, '')))[1]::text end, ''
  union all
  select 50, 'every existing row has recovery_count 0 (AFTER 053)',
         case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portfolio_items' and column_name = 'recovery_count') = 0 then 'NOTE: not yet'
              else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.portfolio_items where recovery_count <> 0', false, true, '')))[1]::text end, ''
  union all
  select 60, 'claim_render_recovery exists (AFTER 053)',
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'claim_render_recovery') then 'PASS' else 'NOTE: not yet' end, ''
  union all
  select 70, 'recovery spend recorded so far', 'NOTE', case when to_regclass('public.render_recovery_ledger') is null then 'table missing'
         else (xpath('/row/c/text()', query_to_xml('select coalesce(sum(reserved_usd), 0) as c from public.render_recovery_ledger', false, true, '')))[1]::text || ' USD reserved in total' end
  union all
  select 80, 'browser roles cannot read the ledger or call the function (AFTER 053)',
         case when to_regclass('public.render_recovery_ledger') is null then 'NOTE: not yet'
              when not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'render_recovery_ledger' and grantee in ('anon', 'authenticated'))
                   and not has_function_privilege('anon', 'public.claim_render_recovery(uuid, numeric, numeric, int, int, text[], text)', 'execute')
                   and not has_function_privilege('authenticated', 'public.claim_render_recovery(uuid, numeric, numeric, int, int, text[], text)', 'execute')
              then 'PASS' else 'FAIL: a browser role has access' end, ''
) t order by ord, check_name;
