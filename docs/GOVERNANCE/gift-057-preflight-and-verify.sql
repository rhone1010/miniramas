-- READ-ONLY. Run in the Supabase SQL Editor before and after applying supabase/migrations/057_gift_collection_entrance.sql.
-- Before: dependencies present, "not applied yet" for the new objects. After: everything present, nothing FAIL.
select 'dependency: 047/048 tables and 056 column' as check_name,
       case when to_regclass('public.gift_sessions') is not null and to_regclass('public.gift_batches') is not null and to_regclass('public.gift_previews') is not null
             and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_sessions' and column_name = 'final_approved_at')
            then 'present' else 'FAIL: apply 047, 048, 055 and 056 first' end as result,
       null::text as detail
union all
select 'dependency: owned-artwork tables (portfolios, portfolio_items, preview_ledger)',
       case when to_regclass('public.portfolios') is not null and to_regclass('public.portfolio_items') is not null and to_regclass('public.preview_ledger') is not null then 'present' else 'FAIL: missing' end, null
union all
select 'collection_preview_id column',
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_sessions' and column_name = 'collection_preview_id') then 'present' else 'not applied yet' end, null
union all
select 'gift_create_collection_session()',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'gift_create_collection_session') then 'present' else 'not applied yet' end, null
union all
select 'gift_batches checks (kind, effects) widened',
       case when exists (select 1 from pg_constraint where conrelid = to_regclass('public.gift_batches') and conname = 'gift_batches_kind_check_057')
             and exists (select 1 from pg_constraint where conrelid = to_regclass('public.gift_batches') and conname = 'gift_batches_effects_check_057') then 'present' else 'not applied yet' end, null
union all
select 'no existing batch violates the widened checks (expected 0)',
       (select count(*)::text from public.gift_batches where not ((kind = 'collection' and cardinality(effect_ids) = 1) or (kind in ('free','paid') and cardinality(effect_ids) = 6))), null
union all
select 'browser roles cannot execute the new function',
       case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'gift_create_collection_session') then 'not applied yet'
            when has_function_privilege('anon', 'public.gift_create_collection_session(uuid,uuid,uuid,uuid,uuid,text,text,int,int,jsonb,text,timestamptz,text,text,int,int)', 'execute')
              or has_function_privilege('authenticated', 'public.gift_create_collection_session(uuid,uuid,uuid,uuid,uuid,text,text,int,int,jsonb,text,timestamptz,text,text,int,int)', 'execute') then 'FAIL: a browser role can execute it'
            else 'ok' end, null
union all
select 'collection sessions (expected 0 until the feature is used)',
       (select count(*)::text from public.gift_sessions g where to_jsonb(g)->>'collection_preview_id' is not null), null;
