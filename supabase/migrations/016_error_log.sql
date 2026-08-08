-- 016_error_log.sql
-- Liten & Co — long-form incident capture, formatted for debugging.
--
-- One row per distinct failure, deduped by fingerprint. Repeat occurrences
-- increment `count` rather than creating new rows, so the panel can show
-- "x147 since Tuesday" — the pattern is usually the answer.
--
-- qa_log_id links an incident to the render telemetry that already captured
-- the settings snapshot, duration and cost, so nothing is duplicated.
--
-- Redaction happens in the application before insert. No keys, no customer
-- email, no image bytes, no prompt text — prompt bodies are referenced by
-- hash only.

begin;

create table if not exists public.error_log (
  id           bigserial primary key,
  incident_id  text not null,
  created_at   timestamptz not null default now(),
  severity     text not null default 'error',
  surface      text not null,
  component    text not null,
  series       text,
  preset       text,
  summary      text not null,
  message      text,
  stack        text,
  upstream     jsonb,
  inputs       jsonb,
  context      jsonb,
  timeline     jsonb,
  qa_log_id    uuid,
  owner_key    text,
  correlation  jsonb,
  fingerprint  text not null,
  count        integer not null default 1,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  status       text not null default 'open',
  notes        text
);

do $$ begin alter table public.error_log add constraint error_log_incident_id_key
  unique (incident_id); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.error_log add constraint error_log_fingerprint_key
  unique (fingerprint); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.error_log add constraint error_log_severity_check
  check (severity = any (array['fatal','error','warn'])); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.error_log add constraint error_log_surface_check
  check (surface = any (array['engine','route','client','webhook','build'])); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.error_log add constraint error_log_status_check
  check (status = any (array['open','ack','resolved','wontfix'])); exception when duplicate_object or duplicate_table then null; end $$;

create index if not exists error_log_status_idx   on public.error_log (status, last_seen desc);
create index if not exists error_log_lastseen_idx on public.error_log (last_seen desc);
create index if not exists error_log_surface_idx  on public.error_log (surface, last_seen desc);

alter table public.error_log enable row level security;
-- No policies: service role only.

-- ── Upsert helper ───────────────────────────────────────────
-- Called by logIncident(). New fingerprint inserts; a repeat bumps the
-- counter and refreshes the payload with the most recent occurrence.
create or replace function public.log_incident(
  p_incident_id text, p_severity text, p_surface text, p_component text,
  p_summary text, p_message text, p_stack text, p_fingerprint text,
  p_series text default null, p_preset text default null,
  p_upstream jsonb default null, p_inputs jsonb default null,
  p_context jsonb default null, p_timeline jsonb default null,
  p_qa_log_id uuid default null, p_owner_key text default null,
  p_correlation jsonb default null
) returns text language plpgsql as $$
declare v_id text;
begin
  insert into public.error_log (
    incident_id, severity, surface, component, series, preset, summary,
    message, stack, upstream, inputs, context, timeline, qa_log_id,
    owner_key, correlation, fingerprint
  ) values (
    p_incident_id, p_severity, p_surface, p_component, p_series, p_preset,
    p_summary, p_message, p_stack, p_upstream, p_inputs, p_context,
    p_timeline, p_qa_log_id, p_owner_key, p_correlation, p_fingerprint
  )
  on conflict (fingerprint) do update set
    count      = public.error_log.count + 1,
    last_seen  = now(),
    message    = excluded.message,
    stack      = excluded.stack,
    upstream   = excluded.upstream,
    inputs     = excluded.inputs,
    context    = excluded.context,
    timeline   = excluded.timeline,
    qa_log_id  = excluded.qa_log_id,
    status     = case when public.error_log.status = 'resolved'
                      then 'open' else public.error_log.status end
  returning incident_id into v_id;
  return v_id;
end $$;

commit;
