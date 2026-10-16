-- gift-047-preflight-and-verify.sql
--
-- READ-ONLY. Run in the Supabase SQL editor (project dqctwzertbujhsjatfyv, shared by Preview and Production), in two parts.
-- PART A before applying supabase/migrations/047_gift_wizard_sessions.sql, PART B after. Neither part changes anything.

-- ═══ PART A: preflight (every row should say PASS) ═════════════════════════════════════════════════════════════════
select 'no existing gift tables' as check,
       case when to_regclass('public.gift_sessions') is null and to_regclass('public.gift_batches') is null
             and to_regclass('public.gift_previews') is null and to_regclass('public.gift_preview_packs') is null
            then 'PASS' else 'FAIL: a gift_ table already exists' end as result
union all
select 'no existing gift functions',
       case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.proname in ('gift_reserve_batch', 'gift_claim_preview', 'gift_fulfill_preview_pack'))
            then 'PASS' else 'FAIL: a gift_ function already exists' end
union all
select 'service_role exists', case when exists (select 1 from pg_roles where rolname = 'service_role') then 'PASS' else 'FAIL' end
union all
select 'gen_random_uuid() available', case when gen_random_uuid() is not null then 'PASS' else 'FAIL' end
union all
select 'private previews bucket exists',
       case when exists (select 1 from storage.buckets where id = 'previews' and public = false) then 'PASS'
            when exists (select 1 from storage.buckets where id = 'previews') then 'FAIL: bucket is PUBLIC'
            else 'FAIL: no previews bucket' end
union all
select 'migration 046 present (print pipeline, unrelated but expected)', case when to_regclass('public.print_asset_jobs') is not null then 'PASS' else 'NOTE: 046 not applied' end;

-- ═══ PART B: after applying 047 (every row should say PASS) ═══════════════════════════════════════════════════════
select 'tables exist with RLS on' as check,
       case when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname in ('gift_sessions', 'gift_batches', 'gift_previews', 'gift_preview_packs') and c.relrowsecurity) = 4
            then 'PASS' else 'FAIL' end as result
union all
select 'service_role can execute all three functions',
       case when has_function_privilege('service_role', 'public.gift_reserve_batch(uuid, uuid, text, text[], int)', 'execute')
             and has_function_privilege('service_role', 'public.gift_claim_preview(uuid, uuid, int, int)', 'execute')
             and has_function_privilege('service_role', 'public.gift_fulfill_preview_pack(uuid, text, int)', 'execute')
            then 'PASS' else 'FAIL: service_role cannot execute (re-run the grants at the end of 047)' end
union all
select 'anon and authenticated cannot execute any of them',
       case when not (has_function_privilege('anon', 'public.gift_reserve_batch(uuid, uuid, text, text[], int)', 'execute')
                   or has_function_privilege('authenticated', 'public.gift_reserve_batch(uuid, uuid, text, text[], int)', 'execute')
                   or has_function_privilege('anon', 'public.gift_claim_preview(uuid, uuid, int, int)', 'execute')
                   or has_function_privilege('authenticated', 'public.gift_claim_preview(uuid, uuid, int, int)', 'execute')
                   or has_function_privilege('anon', 'public.gift_fulfill_preview_pack(uuid, text, int)', 'execute')
                   or has_function_privilege('authenticated', 'public.gift_fulfill_preview_pack(uuid, text, int)', 'execute'))
            then 'PASS' else 'FAIL: a browser role can execute a gift function' end
union all
select 'anon and authenticated have no table access',
       case when not exists (select 1 from information_schema.role_table_grants
                              where table_schema = 'public' and table_name like 'gift\_%' and grantee in ('anon', 'authenticated'))
            then 'PASS' else 'FAIL: a browser role has a table grant' end
union all
select 'tables are empty (nothing seeded)',
       case when (select count(*) from public.gift_sessions) + (select count(*) from public.gift_preview_packs) = 0 then 'PASS' else 'NOTE: rows exist' end;
