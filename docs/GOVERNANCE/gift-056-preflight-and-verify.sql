-- READ-ONLY. Run in the Supabase SQL Editor before and after applying supabase/migrations/056_gift_final_approval.sql.
-- Before: "not applied yet". After: both functions present, closed to browser roles, column present; no session is both released and un-finalized by this migration.
select 'final_approved_at column' as check_name,
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_sessions' and column_name = 'final_approved_at') then 'present' else 'not applied yet' end as result,
       null::text as detail
union all
select 'gift_finalize_order / gift_release_order',
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('gift_finalize_order', 'gift_release_order')) = 2 then 'present' else 'not applied yet' end,
       null
union all
select 'browser roles cannot execute the new functions',
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('gift_finalize_order', 'gift_release_order')) < 2 then 'not applied yet'
            when has_function_privilege('anon', 'public.gift_finalize_order(uuid,uuid,uuid,text,text)', 'execute') or has_function_privilege('authenticated', 'public.gift_finalize_order(uuid,uuid,uuid,text,text)', 'execute')
              or has_function_privilege('anon', 'public.gift_release_order(uuid)', 'execute') or has_function_privilege('authenticated', 'public.gift_release_order(uuid)', 'execute') then 'FAIL: a browser role can execute it'
            else 'ok' end,
       null
union all
select 'orders finalized but not released (expected 0 until someone approves)',
       (select count(*)::text from public.gift_sessions g where to_jsonb(g)->>'final_approved_at' is not null and g.approved_at is null),
       null;
