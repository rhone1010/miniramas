-- READ-ONLY. Run in the Supabase SQL Editor before and after applying supabase/migrations/059_gift_generation_ledger.sql.
-- Before: dependencies present, "not applied yet" for the new objects, nothing FAIL. After: everything present, nothing FAIL.
-- 059 is additive. It changes no existing row; it widens two gift_batches checks (the 057 checks are replaced by _059 versions), adds gift_sessions.flow (default 'previews'),
-- gift_preview_packs.units (default 6), gift_free_grants.generation_id and gift_compositions.generation_id (nullable), and a new table gift_generations with its functions.
select 'dependency: 047/048, 055, 056, 057 objects' as check_name,
       case when to_regclass('public.gift_sessions') is not null and to_regclass('public.gift_batches') is not null and to_regclass('public.gift_previews') is not null
             and to_regclass('public.gift_free_grants') is not null and to_regclass('public.gift_compositions') is not null and to_regclass('public.gift_preview_packs') is not null
             and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_sessions' and column_name = 'final_approved_at')
             and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_sessions' and column_name = 'collection_preview_id')
            then 'present' else 'FAIL: apply 047-057 first' end as result,
       null::text as detail
union all
select 'the 057 batch checks to be replaced exist (or 059 is already applied)',
       case when exists (select 1 from pg_constraint where conrelid = to_regclass('public.gift_batches') and conname = 'gift_batches_kind_check_059') then 'already applied'
            when exists (select 1 from pg_constraint where conrelid = to_regclass('public.gift_batches') and conname = 'gift_batches_kind_check_057')
             and exists (select 1 from pg_constraint where conrelid = to_regclass('public.gift_batches') and conname = 'gift_batches_effects_check_057') then 'present (will be replaced)'
            else 'FAIL: unexpected gift_batches checks; do not apply' end, null
union all
select 'gift_sessions.flow', case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_sessions' and column_name = 'flow') then 'present' else 'not applied yet' end, null
union all
select 'gift_preview_packs.units', case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_preview_packs' and column_name = 'units') then 'present' else 'not applied yet' end, null
union all
select 'gift_generations table', case when to_regclass('public.gift_generations') is not null then 'present' else 'not applied yet' end, null
union all
select 'gift_compositions.generation_id / gift_free_grants.generation_id',
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_compositions' and column_name = 'generation_id')
             and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_free_grants' and column_name = 'generation_id') then 'present' else 'not applied yet' end, null
union all
select 'functions: choose_effect, reserve_generation, reserve_correction, claim, complete, fail, accept, status',
       (select count(*)::text || ' of 9 present' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('gift_choose_effect', 'gift_generation_slot', 'gift_reserve_generation', 'gift_reserve_correction', 'gift_claim_generation', 'gift_complete_generation', 'gift_fail_generation', 'gift_accept_generation', 'gift_generation_status')), null
union all
select 'existing batches by kind (059 must leave these counts unchanged)', (select coalesce(string_agg(kind || '=' || n, ', ' order by kind), 'none') from (select kind, count(*) n from public.gift_batches group by kind) t), null
union all
select 'no existing batch violates the widened checks (expected 0)',
       (select count(*)::text from public.gift_batches where not ((kind in ('collection', 'generation') and cardinality(effect_ids) = 1) or (kind in ('free', 'paid') and cardinality(effect_ids) = 6))), null
union all
select 'existing preview packs by status (each becomes worth 6 generations; paid ones stay usable)', (select coalesce(string_agg(status || '=' || n, ', ' order by status), 'none') from (select status, count(*) n from public.gift_preview_packs group by status) t), null
union all
select 'sessions by flow (expected all previews until the feature is switched on)',
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_sessions' and column_name = 'flow')
            then (select coalesce(string_agg(flow || '=' || n, ', '), 'none') from (select coalesce(to_jsonb(g)->>'flow', 'previews') as flow, count(*) n from public.gift_sessions g group by 1) t) else 'not applied yet' end, null
union all
select 'generations recorded (expected 0 until the feature is used)', case when to_regclass('public.gift_generations') is not null then (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.gift_generations', false, true, '')))[1]::text else 'not applied yet' end, null
union all
select 'browser roles cannot read gift_generations or execute the new functions',
       case when to_regclass('public.gift_generations') is null then 'not applied yet'
            when has_table_privilege('anon', 'public.gift_generations', 'select') or has_table_privilege('authenticated', 'public.gift_generations', 'select')
              or exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                          where n.nspname = 'public' and p.proname in ('gift_choose_effect', 'gift_reserve_generation', 'gift_reserve_correction', 'gift_claim_generation', 'gift_complete_generation', 'gift_fail_generation', 'gift_accept_generation', 'gift_generation_status', 'gift_generation_slot')
                            and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))) then 'FAIL: a browser role has access'
            else 'ok' end, null;
