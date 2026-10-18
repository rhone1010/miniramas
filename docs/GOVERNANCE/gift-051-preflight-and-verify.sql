-- gift-051-preflight-and-verify.sql
--
-- READ-ONLY. Run as ONE statement before applying supabase/migrations/051_gift_session_rate_limit.sql (the first rows PASS, the post-apply rows say "not yet"),
-- then again after (every row PASS). 051 adds one table (gift_session_attempts) and one function (gift_record_session_attempt). It changes no existing
-- function, table or row.

select check_name, result, detail from (
  select 10 as ord, '047 applied (gift_sessions exists)' as check_name,
         case when to_regclass('public.gift_sessions') is not null then 'PASS' else 'FAIL: apply 047 first' end as result, '' as detail
  union all
  select 20, '051 state', 'NOTE', case when to_regclass('public.gift_session_attempts') is not null then 'applied' else 'not applied yet' end
  union all
  select 30, 'function gift_record_session_attempt exists (AFTER 051)',
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'gift_record_session_attempt') then 'PASS' else 'NOTE: not yet' end, ''
  union all
  select 40, 'attempt ledger rows', 'NOTE', case when to_regclass('public.gift_session_attempts') is null then 'table missing' else (select count(*)::text || ' rows' from public.gift_session_attempts) end
  union all
  select 50, 'browser roles cannot read or call it (AFTER 051)',
         case when to_regclass('public.gift_session_attempts') is null then 'NOTE: not yet'
              when not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'gift_session_attempts' and grantee in ('anon', 'authenticated'))
                   and not has_function_privilege('anon', 'public.gift_record_session_attempt(uuid, text, int, int, int)', 'execute')
              then 'PASS' else 'FAIL: a browser role has access' end, ''
) t order by ord, check_name;
