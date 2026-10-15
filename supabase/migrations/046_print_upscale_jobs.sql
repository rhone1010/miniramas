-- 046_print_upscale_jobs.sql
--
-- APPLIED to the shared Supabase project (miniramas, dqctwzertbujhsjatfyv) on 2026-10-15 after approval, and verified:
-- enum has withheld, global defaults seeded, 0 jobs, four functions present. (Comment-only edit after applying.)
--
-- Remote configuration and durable, resumable jobs for the Print Shop upscale stage
-- (prunaai/p-image-upscale, via Replicate or Pruna's direct API).
--
-- Reuses: print_orders (no table change; a held order uses the 'withheld' status, added to the enum below if missing),
-- support_messages (the Concierge record; one row per job needing review, id = job id),
-- account_flags / admin auth (settings are written only through the existing admin gate).
--
-- All three tables are SERVICE ROLE ONLY: RLS on, no policies, public/anon/authenticated revoked.
begin;

-- The order status 'withheld' is written by the existing account gate (db.ts markWithheld) and by this pipeline's holds,
-- but migration 012 never created it (verified: its enum is created,paid,placed,in_production,shipped,delivered,
-- cancelled,error). Without it every hold fails to save. No-op where the live database already has it. PostgreSQL 12+
-- allows this inside a transaction; the value is not used until after commit.
alter type public.print_order_status add value if not exists 'withheld';

-- ── 1. SETTINGS ────────────────────────────────────────────────────────────
-- One 'global' row holds every value. A 'family:<finish>' or 'sku:<SKU>' row holds ONLY the
-- columns it overrides; NULL means inherit. Resolution order: sku, then family, then global.
create table public.print_upscale_settings (
  scope                  text primary key
                         check (scope = 'global' or scope ~ '^(family|sku):[A-Za-z0-9_-]+$'),
  provider               text    check (provider in ('replicate','pruna')),
  target_ppi             integer check (target_ppi between 72 and 600),
  max_megapixels         integer check (max_megapixels between 1 and 128),
  output_format          text    check (output_format in ('jpg','png','webp')),
  output_quality         integer check (output_quality between 0 and 100),
  enhance_details        boolean,
  enhance_realism        boolean,
  disable_safety_checker boolean,
  min_source_ppi         integer check (min_source_ppi between 0 and 600),
  qa_enabled             boolean,
  human_approval         text    check (human_approval in ('all','flagged')),
  version                integer not null default 1,
  updated_at             timestamptz not null default now(),
  updated_by             text,
  constraint print_upscale_global_complete check (scope <> 'global' or (
    provider is not null and target_ppi is not null and max_megapixels is not null and
    output_format is not null and output_quality is not null and enhance_details is not null and
    enhance_realism is not null and disable_safety_checker is not null and min_source_ppi is not null and
    qa_enabled is not null and human_approval is not null))
);

-- Every change is kept: this is the audit trail for who changed what, and when.
create table public.print_upscale_settings_history (
  id         bigserial primary key,
  scope      text        not null,
  op         text        not null,
  row_data   jsonb       not null,
  changed_at timestamptz not null default now(),
  changed_by text
);

create function public.print_upscale_settings_audit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    insert into public.print_upscale_settings_history(scope, op, row_data, changed_by)
      values (old.scope, tg_op, to_jsonb(old), old.updated_by);
    return old;
  end if;
  insert into public.print_upscale_settings_history(scope, op, row_data, changed_by)
    values (new.scope, tg_op, to_jsonb(new), new.updated_by);
  return new;
end $$;

create trigger print_upscale_settings_audit
  after insert or update or delete on public.print_upscale_settings
  for each row execute function public.print_upscale_settings_audit();

-- Initial defaults (approved): Replicate, 300 PPI, jpg, quality 95, every enhancement off.
-- 'human_approval = flagged' sends only uncertain or defective results to the review queue;
-- set it to 'all' from the admin panel to hold every job for a person.
insert into public.print_upscale_settings
  (scope, provider, target_ppi, max_megapixels, output_format, output_quality,
   enhance_details, enhance_realism, disable_safety_checker, min_source_ppi, qa_enabled, human_approval, updated_by)
values ('global', 'replicate', 300, 128, 'jpg', 95, false, false, false, 100, true, 'flagged', 'migration-046');

-- ── 2. JOBS ────────────────────────────────────────────────────────────────
-- One row per order line. Processing is resumable: each step writes its result before the next
-- begins, so a crash resumes from the last saved step rather than repeating (and re-paying for) it.
create table public.print_asset_jobs (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.print_orders(id),
  item_index         integer not null,
  revision           integer not null default 0,
  render_id          text not null,
  sku                text not null,
  size               text not null,
  finish             text not null,
  source_kind        text not null check (source_kind in ('owned','url')),

  status             text not null default 'queued' check (status in (
                       'queued','preparing','ready_to_submit','submitting','upscaling',
                       'finishing','qa','approved','review','rejected','failed')),
  lease_token        uuid,
  lease_until        timestamptz,
  attempts           integer not null default 0,
  error              text,

  -- Frozen when the job starts. Later config changes never affect an in-flight job.
  settings_snapshot  jsonb,
  settings_hash      text,
  settings_version   integer,

  -- The aspect-corrected artwork (after any outpaint or extension): the QA reference.
  source_sha256      text,
  input_path         text,
  input_sha256       text,
  input_w            integer,
  input_h            integer,
  source_ppi         numeric(8,2),
  warnings           jsonb not null default '[]'::jsonb,

  target_mp          integer,
  required_front_w   integer,
  required_front_h   integer,
  required_final_w   integer,
  required_final_h   integer,

  -- Provider call. submit_state exists for the crash window between creating a prediction and
  -- saving its id: see lib/v1/print/upscale/process.ts.
  provider           text,
  submit_state       text not null default 'none' check (submit_state in ('none','submitting','submitted')),
  submit_attempts    integer not null default 0,
  submit_started_at  timestamptz,
  possible_duplicate boolean not null default false,
  prediction_id      text,
  output_path        text,
  output_w           integer,
  output_h           integer,
  upscale_ms         integer,
  cost_usd_est       numeric(10,4),
  cost_basis         text,

  final_path         text,
  final_sha256       text,
  final_w            integer,
  final_h            integer,

  qa                 jsonb,
  qa_verdict         text check (qa_verdict in ('pass','uncertain','defect','skipped','error')),
  review_reason      text,
  reviewed_by        text,
  reviewed_at        timestamptz,
  review_note        text,
  notified_at        timestamptz,
  events             jsonb not null default '[]'::jsonb,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint print_asset_jobs_one_per_line unique (order_id, item_index, revision)
);

create index print_asset_jobs_work on public.print_asset_jobs (updated_at)
  where status in ('queued','preparing','ready_to_submit','submitting','upscaling','finishing','qa');
create index print_asset_jobs_review on public.print_asset_jobs (created_at) where status = 'review';
create index print_asset_jobs_order on public.print_asset_jobs (order_id);

-- ── 3. FUNCTIONS ───────────────────────────────────────────────────────────
-- Enqueue is idempotent: the same line enqueued twice returns the same row.
create function public.enqueue_print_asset_job(
  p_order uuid, p_index integer, p_render text, p_sku text, p_size text, p_finish text,
  p_source_kind text, p_revision integer default 0)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare j public.print_asset_jobs;
begin
  insert into public.print_asset_jobs(order_id, item_index, revision, render_id, sku, size, finish, source_kind)
    values (p_order, p_index, p_revision, p_render, p_sku, p_size, p_finish, p_source_kind)
    on conflict (order_id, item_index, revision) do nothing;
  select * into j from public.print_asset_jobs
    where order_id = p_order and item_index = p_index and revision = p_revision;
  return to_jsonb(j);
end $$;

-- Single-flight: only one worker holds a job at a time. A lease that has expired (a crashed
-- worker) can be taken over, which is how a crashed job resumes.
create function public.lease_print_asset_job(p_id uuid, p_seconds integer, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare j public.print_asset_jobs;
begin
  update public.print_asset_jobs
     set lease_token = p_token, lease_until = now() + make_interval(secs => p_seconds),
         attempts = attempts + 1, updated_at = now()
   where id = p_id
     and status in ('queued','preparing','ready_to_submit','submitting','upscaling','finishing','qa')
     and (lease_until is null or lease_until < now())
  returning * into j;
  if not found then return null; end if;
  return to_jsonb(j);
end $$;

-- A person decides a held job. Only 'review' can move, and only to approved or rejected.
create function public.review_print_asset_job(p_id uuid, p_decision text, p_by text, p_note text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare j public.print_asset_jobs;
begin
  if p_decision not in ('approved','rejected') then raise exception 'invalid_review_decision'; end if;
  update public.print_asset_jobs
     set status = p_decision, reviewed_by = p_by, reviewed_at = now(), review_note = left(coalesce(p_note,''), 1000),
         lease_token = null, lease_until = null, updated_at = now()
   where id = p_id and status = 'review'
  returning * into j;
  if not found then raise exception 'job_not_in_review'; end if;
  return to_jsonb(j);
end $$;

-- ── 4. ACCESS ──────────────────────────────────────────────────────────────
alter table public.print_upscale_settings         enable row level security;
alter table public.print_upscale_settings_history enable row level security;
alter table public.print_asset_jobs               enable row level security;
revoke all on public.print_upscale_settings, public.print_upscale_settings_history, public.print_asset_jobs
  from public, anon, authenticated;
grant select, insert, update on public.print_upscale_settings to service_role;
grant select on public.print_upscale_settings_history to service_role;
grant select, insert, update on public.print_asset_jobs to service_role;
grant usage, select on sequence public.print_upscale_settings_history_id_seq to service_role;
revoke all on function public.enqueue_print_asset_job(uuid,integer,text,text,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.lease_print_asset_job(uuid,integer,uuid) from public, anon, authenticated;
revoke all on function public.review_print_asset_job(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.print_upscale_settings_audit() from public, anon, authenticated;

commit;
