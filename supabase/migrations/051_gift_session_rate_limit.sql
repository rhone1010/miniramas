-- 051_gift_session_rate_limit.sql
--
-- Gift Wizard: a server-enforced, PERSISTENT rate limit on photo analysis (session creation). NOT APPLIED. Requires 047. Independent of 050.
--
-- Creating a session runs a paid photo analysis (OpenAI classification and the age checks). Every attempt is recorded in gift_session_attempts BEFORE
-- the analysis runs, in a table that has no link to gift_sessions, so deleting and recreating sessions (or failing analysis on purpose) cannot reset or
-- bypass the limit. The check and the record are one atomic step per account (an advisory transaction lock), so concurrent requests cannot slip past it.
--     per account, 1 hour          10 attempts
--     per account, 24 hours        30 attempts
--     per account and photograph   5 attempts in 24 hours (the photograph is identified by the SHA-256 of its bytes)
-- The numbers are function parameters, so changing them needs no migration. Additive and idempotent; changes no existing function or row.

create table if not exists public.gift_session_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  source_sha256  text not null,
  created_at     timestamptz not null default now()
);
create index if not exists gift_session_attempts_user_idx  on public.gift_session_attempts(user_id, created_at);
create index if not exists gift_session_attempts_photo_idx on public.gift_session_attempts(user_id, source_sha256, created_at);
alter table public.gift_session_attempts enable row level security;

-- Record one attempt, or raise 'rate_limited' (nothing is recorded then). Old rows are pruned as they pass the longest window.
create or replace function public.gift_record_session_attempt(p_user uuid, p_sha text, p_hour_cap int default 10, p_day_cap int default 30, p_photo_cap int default 5)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('gift_session_attempt:' || p_user::text, 0));
  delete from public.gift_session_attempts where user_id = p_user and created_at < now() - interval '2 days';
  if (select count(*) from public.gift_session_attempts where user_id = p_user and created_at > now() - interval '1 hour') >= p_hour_cap
     or (select count(*) from public.gift_session_attempts where user_id = p_user and created_at > now() - interval '24 hours') >= p_day_cap
     or (select count(*) from public.gift_session_attempts where user_id = p_user and source_sha256 = p_sha and created_at > now() - interval '24 hours') >= p_photo_cap
  then raise exception 'rate_limited'; end if;
  insert into public.gift_session_attempts(user_id, source_sha256) values (p_user, p_sha);
end $$;

revoke all on function public.gift_record_session_attempt(uuid, text, int, int, int) from public, anon, authenticated;
revoke all on public.gift_session_attempts from anon, authenticated;
grant execute on function public.gift_record_session_attempt(uuid, text, int, int, int) to service_role;
grant select, insert, update, delete on public.gift_session_attempts to service_role;
