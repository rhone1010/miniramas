-- gift-049-preflight-and-verify.sql
--
-- READ-ONLY. Run in the Supabase SQL editor. ONE statement: run it before applying supabase/migrations/049_gift_composition_geometry.sql
-- (the first rows should be PASS and the post-apply rows should say "not applied yet"), then again after (every row PASS).
-- 049 only adds eight columns, three checks and an index to gift_compositions; it changes no function and no permission.

select check_name, result, detail from (
  select 10 as ord, '048 applied (gift_compositions exists)' as check_name,
         case when to_regclass('public.gift_compositions') is not null then 'PASS' else 'FAIL: apply 048 first' end as result, '' as detail
  union all
  select 20, 'gift_compositions has no rows that 049 could disturb', 'NOTE',
         case when to_regclass('public.gift_compositions') is null then 'table missing' else (select count(*)::text || ' rows' from public.gift_compositions) end
  union all
  select 30, '049 state', 'NOTE',
         case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_compositions' and column_name = 'geometry_key')
              then 'applied' else 'not applied yet' end
  union all
  select 40, 'column ' || c || ' exists on gift_compositions (expected AFTER applying 049)',
         case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_compositions' and column_name = c) then 'PASS' else 'NOTE: not yet' end, ''
    from unnest(array['geometry_key', 'method', 'source_composition_id', 'generation_mode', 'generation_aspect', 'nb21_calls', 'outpaint_calls', 'cost_usd_est']) as c
  union all
  select 50, 'check constraint ' || k || ' exists (AFTER 049)',
         case when exists (select 1 from pg_constraint where conname = k) then 'PASS' else 'NOTE: not yet' end, ''
    from unnest(array['gift_compositions_method_check', 'gift_compositions_generation_mode_check', 'gift_compositions_calls_check']) as k
  union all
  select 60, 'browser roles still have no access to gift_compositions',
         case when not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'gift_compositions' and grantee in ('anon', 'authenticated'))
              then 'PASS' else 'FAIL: a browser role has a table grant' end, ''
) t order by ord, check_name;
