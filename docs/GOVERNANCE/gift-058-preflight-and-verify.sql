-- READ-ONLY. Run in the Supabase SQL Editor before and after applying supabase/migrations/058_gift_preview_generation_record.sql.
select 'gift_previews.generation column' as check_name,
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gift_previews' and column_name = 'generation') then 'present' else 'not applied yet' end as result,
       null::text as detail
union all
select 'previews with a generation record (expected 0 until new previews are made)',
       (select count(*)::text from public.gift_previews g where to_jsonb(g)->>'generation' is not null), null
union all
select 'browser roles have no access to gift_previews',
       case when has_table_privilege('anon', 'public.gift_previews', 'select') or has_table_privilege('authenticated', 'public.gift_previews', 'select') then 'FAIL: a browser role can read it' else 'ok' end, null;
