-- 002_queued_jobs.sql
-- Background job queue for "email me when ready" requests.
--
-- When upstream image generation is overloaded, the customer can opt to be
-- emailed when their image is ready. The original POST body is stored in
-- request_body and replayed by a cron-triggered worker.
--
-- All access is via Next.js API routes using the service role key. No RLS
-- policies — explicit GRANTs at the bottom (matches the bundles table).

create table if not exists queued_jobs (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  product       text not null,
  request_body  jsonb not null,
  status        text not null default 'queued'
                  check (status in ('queued', 'processing', 'completed', 'failed')),
  attempt_count int  not null default 0,
  result_url    text,
  error_message text,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  completed_at  timestamptz
);

create index if not exists queued_jobs_status_idx on queued_jobs (status, created_at);
create index if not exists queued_jobs_email_idx  on queued_jobs (email);

grant all on queued_jobs to service_role;

-- Public bucket for finished images. Worker uploads here, email links to the
-- public object URL. Idempotent.
insert into storage.buckets (id, name, public)
values ('queue-results', 'queue-results', true)
on conflict (id) do nothing;
