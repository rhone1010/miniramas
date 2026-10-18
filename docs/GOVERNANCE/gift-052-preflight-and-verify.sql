-- gift-052-preflight-and-verify.sql
--
-- READ-ONLY. Run as ONE statement before applying supabase/migrations/052_gift_composition_repair.sql (the first rows PASS, the post-apply rows say "not yet"),
-- then again after (every row PASS). 052 adds one column (gift_compositions.repair_seq), widens one unique key, adds one table (gift_repair_claims) and three
-- functions. It changes no existing row.

select check_name, result, detail from (
  select 10 as ord, '048 and 049 applied (gift_compositions with geometry_key)' as check_name,
         case when to_regclass('public.gift_compositions') is not null
                and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_compositions' and column_name = 'geometry_key')
              then 'PASS' else 'FAIL: apply 048 and 049 first' end as result, '' as detail
  union all
  select 20, '052 state', 'NOTE', case when to_regclass('public.gift_repair_claims') is not null then 'applied' else 'not applied yet' end
  union all
  select 30, 'repair_seq column exists (AFTER 052)',
         case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_compositions' and column_name = 'repair_seq') then 'PASS' else 'NOTE: not yet' end, ''
  union all
  select 40, 'every existing composition has repair_seq 0 (AFTER 052)',
         case when not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_compositions' and column_name = 'repair_seq') then 'NOTE: not yet'
              else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.gift_compositions where repair_seq <> 0', false, true, '')))[1]::text end, ''
  union all
  select 50, 'one unique key on gift_compositions (AFTER 052: the repair_seq key)',
         case when exists (select 1 from pg_constraint where conrelid = 'public.gift_compositions'::regclass and conname = 'gift_compositions_line_attempt_repair_key') then 'PASS' else 'NOTE: not yet' end,
         (select count(*)::text || ' unique constraint(s)' from pg_constraint where conrelid = 'public.gift_compositions'::regclass and contype = 'u')
  union all
  select 60, 'repair functions exist (AFTER 052)',
         case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('gift_claim_repair', 'gift_release_repair', 'gift_complete_repair')) = 3 then 'PASS' else 'NOTE: not yet' end, ''
  union all
  select 70, 'live repair claims', 'NOTE', case when to_regclass('public.gift_repair_claims') is null then 'table missing' else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.gift_repair_claims', false, true, '')))[1]::text || ' rows' end
  union all
  select 80, 'browser roles cannot read or call it (AFTER 052)',
         case when to_regclass('public.gift_repair_claims') is null then 'NOTE: not yet'
              when not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'gift_repair_claims' and grantee in ('anon', 'authenticated'))
                   and not has_function_privilege('anon', 'public.gift_claim_repair(uuid, text, uuid, text, int)', 'execute')
                   and not has_function_privilege('authenticated', 'public.gift_complete_repair(uuid, text, uuid, uuid, uuid, jsonb)', 'execute')
              then 'PASS' else 'FAIL: a browser role has access' end, ''
) t order by ord, check_name;
