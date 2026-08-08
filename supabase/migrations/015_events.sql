-- 015_events.sql
-- Liten & Co — on-screen behaviour and campaign attribution.
--
-- Deliberately narrow. Craft outcomes already live in craft_events, and
-- render telemetry already lives in qa_log. This table covers ONLY what
-- nothing else records: navigation, drop-off, and where a visitor came from.
--
-- owner_key is the join to identity_map; anon_id covers visitors who have
-- not yet been assigned one.

begin;

create table if not exists public.events (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  name        text not null,
  anon_id     uuid not null,
  session_id  uuid not null,
  owner_key   text,
  user_id     uuid,
  series      text,
  props       jsonb not null default '{}'::jsonb,
  path        text,
  referrer    text,
  utm         jsonb,
  device      text,
  ua          text,
  country     text
);

create index if not exists events_created_idx      on public.events (created_at desc);
create index if not exists events_name_created_idx on public.events (name, created_at desc);
create index if not exists events_anon_idx         on public.events (anon_id, created_at);
create index if not exists events_session_idx      on public.events (session_id, created_at);
create index if not exists events_owner_idx        on public.events (owner_key);
create index if not exists events_utm_source_idx   on public.events ((utm->>'utm_source'));

alter table public.events enable row level security;
-- No policies: service role only. The ingest route writes; the panel reads.

-- ── Hourly rollup ───────────────────────────────────────────
create table if not exists public.events_hourly (
  hour        timestamptz not null,
  name        text not null,
  series      text not null default '',
  device      text not null default '',
  utm_source  text not null default '',
  count       integer not null default 0,
  primary key (hour, name, series, device, utm_source)
);

create or replace function public.roll_up_events(since timestamptz default now() - interval '3 hours')
returns void language sql as $$
  insert into public.events_hourly (hour, name, series, device, utm_source, count)
  select date_trunc('hour', created_at),
         name,
         coalesce(series, ''),
         coalesce(device, ''),
         coalesce(utm->>'utm_source', ''),
         count(*)
  from public.events
  where created_at >= date_trunc('hour', since)
  group by 1,2,3,4,5
  on conflict (hour, name, series, device, utm_source)
  do update set count = excluded.count;
$$;

commit;
