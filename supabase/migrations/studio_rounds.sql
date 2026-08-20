-- supabase/migrations/0xx_studio_rounds.sql
--
-- Counts Studio rounds so the free generation cap has something to read.
--
-- One row per round of four, written after the images are made. It is a
-- counter and an audit trail of which combinations people actually pick —
-- which is the only place the product will ever learn whether Glass x Storm
-- gets chosen more than Cosmos x Midnight.
--
-- Not a queue and not a job table. Nothing reads a row back except a count.
--
-- The route ALLOWS when this read fails, so the page works before this
-- migration lands — it just has no ceiling until it does.

create table if not exists public.studio_rounds (
  id          uuid primary key default gen_random_uuid(),
  session_id  text        not null,
  ip_hash     text        not null,
  world       text        not null,
  mood        text        not null,
  energy      text        not null,
  palette     text        not null,
  season      text,
  created_at  timestamptz not null default now()
);

-- The two reads the cap makes, and nothing else.
create index if not exists studio_rounds_session_idx
  on public.studio_rounds (session_id);

create index if not exists studio_rounds_ip_day_idx
  on public.studio_rounds (ip_hash, created_at desc);

-- Service role only. The page never reads this and a browser has no reason
-- to know how close anybody is to a ceiling.
alter table public.studio_rounds enable row level security;
