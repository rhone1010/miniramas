-- gift-session-recovery-readonly.sql
--
-- READ-ONLY. Run in the Supabase SQL Editor (as ONE statement per block). Establishes whether a customer's Gift previews were actually generated and stored, or only the
-- browser's reference to the session was lost. Changes nothing. Replace YOUR_EMAIL with the account that used the Wizard.

-- 1. Every Gift session of the account in the last 7 days, with each batch's previews by state. A session that exists with ready previews means the work is SAFE on the
--    server and only the browser lost its reference: the restore endpoint (GET /api/v1/gift/sessions) returns it. 'pending'/'failed' previews with attempts < 3, or
--    'generating' with an old lease, are resumable through POST /sessions/{id}/batches/{n}/retry.
with u as (select id from auth.users where lower(email) = lower('YOUR_EMAIL'))
select s.id as session_id, s.status as session_status, s.created_at, s.last_activity_at, s.expires_at, s.series,
       (s.source_path is not null) as has_photo_path,
       b.batch_index, b.kind, b.created_at as batch_created_at, cardinality(b.effect_ids) as effects_requested,
       count(p.id) as previews,
       count(*) filter (where p.status = 'ready') as ready,
       count(*) filter (where p.status = 'ready' and p.master_path is not null and p.preview_path is not null) as ready_with_paths,
       count(*) filter (where p.status = 'pending') as pending,
       count(*) filter (where p.status = 'generating') as generating,
       count(*) filter (where p.status = 'failed') as failed,
       max(p.attempts) as max_attempts, max(p.lease_until) as latest_lease,
       string_agg(distinct left(p.error, 80), ' | ') filter (where p.error is not null) as errors
from public.gift_sessions s
join u on u.id = s.user_id
left join public.gift_batches b on b.session_id = s.id
left join public.gift_previews p on p.batch_id = b.id
where s.created_at > now() - interval '7 days'
group by s.id, b.id
order by s.created_at desc, b.batch_index;

-- 2. Are the files really in storage (not only the rows)? Paste a session_id from block 1. Expect one source.jpg, and for each ready preview a masters/ and a previews/ object.
select split_part(name, '/', 3) as kind, count(*) as objects, min(created_at) as first, max(created_at) as last
from storage.objects
where bucket_id = 'previews' and name like 'gift/' || 'PASTE_SESSION_ID' || '/%'
group by 1 order by 1;

-- 3. The free-batch ledger for the account (it survives session deletion): confirms whether a free batch was consumed for the batch in block 1.
with u as (select id from auth.users where lower(email) = lower('YOUR_EMAIL'))
select g.created_at, g.session_id, g.batch_id, left(g.source_sha256, 12) as photo_hash
from public.gift_free_grants g join u on u.id = g.user_id
order by g.created_at desc limit 10;
