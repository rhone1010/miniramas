-- 024_feedback.sql
-- User feedback from the "Something off?" panel.
--
-- One row per submission. Screenshots are stored in Supabase Storage
-- (feedback-shots/ bucket); the column holds the storage path, never
-- the base64 data URL.
--
-- Status lifecycle: new → seen → fixed | wontfix | dup.
-- Rows are never deleted — status changes only.

begin;

create table if not exists public.feedback (
  id            uuid          primary key default gen_random_uuid(),
  created_at    timestamptz   not null default now(),
  user_id       uuid          references auth.users(id),
  handle        text,
  kinds         text[]        not null,
  severity      smallint      not null check (severity between 0 and 2),
  "where"       text          not null check ("where" in ('discovery','review','mycoll')),
  what          text          not null,
  expected      text,
  context       jsonb         not null,
  screenshot    text,
  url           text,
  viewport      text,
  release       text          not null default 'test',
  github_issue  integer,
  status        text          not null default 'new'
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_where_idx   on public.feedback ("where", severity);
create index if not exists feedback_status_idx  on public.feedback (status);

-- RLS: users insert their own; only service role reads. Never delete.
alter table public.feedback enable row level security;

do $$ begin
  create policy feedback_insert_own on public.feedback
    for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- ── Digest view (§5) ────────────────────────────────────────────
create or replace view public.feedback_digest as
  select
    date_trunc('day', created_at) as day,
    "where",
    severity,
    count(*)                                  as n,
    count(*) filter (where status = 'new')    as open
  from public.feedback
  group by 1, 2, 3
  order by 1 desc, 3 desc;

-- ── Grants ─────────────────────────────────────────────────────
grant all on public.feedback to service_role;
grant insert on public.feedback to authenticated;
grant select on public.feedback_digest to service_role;

-- ── Storage bucket ───────────────────────────────────────────
-- Private bucket for screenshot uploads. Service role uploads bypass
-- RLS, so no additional storage policies needed.
insert into storage.buckets (id, name, public)
  values ('feedback-shots', 'feedback-shots', false)
  on conflict (id) do nothing;

commit;
