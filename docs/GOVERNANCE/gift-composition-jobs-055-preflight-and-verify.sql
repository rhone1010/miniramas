-- gift-composition-jobs-055-preflight-and-verify.sql
--
-- READ-ONLY. One statement; run before and after applying supabase/migrations/055_gift_composition_jobs.sql. BEFORE: "055 state" says "not applied yet" and every other row is NOTE.
-- AFTER: every row PASS. If the app logs "[gift] gift_composition_jobs is not applied (migration 055)", the table or its functions are missing in the database that deployment uses.

select check_name, result, detail from (
  select 10 as ord, 'gift_sessions exists (047)' as check_name, case when to_regclass('public.gift_sessions') is not null then 'PASS' else 'FAIL: apply 047 first' end as result, '' as detail
  union all
  select 20, '055 state', 'NOTE', case when to_regclass('public.gift_composition_jobs') is not null then 'applied' else 'not applied yet' end
  union all
  select 30, 'gift_composition_jobs has its columns',
         case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'gift_composition_jobs'
                      and column_name in ('session_id','preview_id','geometry_key','line_ids','method','state','token','attempts','claimed_at','expires_at','error_code','updated_at')) = 12 then 'PASS' else 'NOTE: not yet' end, ''
  union all
  select 40, 'the three functions exist',
         case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('gift_claim_composition','gift_finish_composition','gift_fail_composition')) = 3 then 'PASS' else 'NOTE: not yet' end, ''
  union all
  select 50, 'RLS is on',
         case when to_regclass('public.gift_composition_jobs') is null then 'NOTE: not yet' when (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.gift_composition_jobs')) then 'PASS' else 'FAIL: RLS is off' end, ''
  union all
  select 60, 'browser roles cannot touch the table or call the functions',
         case when to_regclass('public.gift_composition_jobs') is null then 'NOTE: not yet'
              when not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'gift_composition_jobs' and grantee in ('anon', 'authenticated'))
                   and not has_function_privilege('anon', 'public.gift_claim_composition(uuid, uuid, text, text[], text, int, int)', 'execute')
                   and not has_function_privilege('authenticated', 'public.gift_claim_composition(uuid, uuid, text, text[], text, int, int)', 'execute') then 'PASS' else 'FAIL: a browser role has access' end, ''
  union all
  select 70, 'the server (service_role) can use them',
         case when to_regclass('public.gift_composition_jobs') is null then 'NOTE: not yet'
              when has_table_privilege('service_role', 'public.gift_composition_jobs', 'select, insert, update, delete')
                   and has_function_privilege('service_role', 'public.gift_claim_composition(uuid, uuid, text, text[], text, int, int)', 'execute') then 'PASS' else 'FAIL: service_role lacks a grant' end, ''
  union all
  select 80, 'jobs right now (preparing / stalled / failed)', 'NOTE',
         case when to_regclass('public.gift_composition_jobs') is null then 'table missing'
              else (xpath('/row/c/text()', query_to_xml('select count(*) filter (where state = ''preparing'' and expires_at > now()) || '' preparing / '' || count(*) filter (where state = ''preparing'' and expires_at <= now()) || '' stalled / '' || count(*) filter (where state = ''failed'') || '' failed'' as c from public.gift_composition_jobs', false, true, '')))[1]::text end
) t order by ord, check_name;
