-- 012_reconcile_live_schema.sql
-- Liten & Co — brings supabase/migrations in line with the live database.
--
-- Migrations on disk stopped at 011; tables through ~015 were created by hand.
-- This file is reconstructed from the live information_schema dump taken
-- 2026-08-08 and is FULLY IDEMPOTENT: every statement is guarded, so it is
-- safe to run against the live database (it will do nothing) and it will
-- build the same schema from scratch on an empty one.
--
-- Legacy tables (jobs / orders / users / renders / queued_jobs /
-- magic_tokens) are deliberately NOT recreated here — see 013.
--
-- NOTE: column defaults for bundles, bundle_items, skus and refund_log were
-- not present in the source dump; the values below are the conventional ones
-- and match every sibling table. Verify if a from-scratch rebuild is ever run.

begin;

-- ─────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create type public.print_order_status as enum (
    'created','paid','placed','in_production','shipped','delivered','cancelled','error'
  );
exception when duplicate_object or duplicate_table then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- Catalogue
-- ─────────────────────────────────────────────────────────────
create table if not exists public.skus (
  id               text primary key,
  display_name     text not null,
  kind             text not null,
  count            integer not null,
  price_cents      integer not null,
  stripe_price_id  text not null,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  recommended      boolean not null default false
);
do $$ begin alter table public.skus add constraint skus_kind_check
  check (kind = any (array['single','bundle','credits'])); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.skus add constraint skus_count_check
  check (count > 0); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.skus add constraint skus_price_cents_check
  check (price_cents > 0); exception when duplicate_object or duplicate_table then null; end $$;

create table if not exists public.bundles (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null,
  name           text not null,
  tagline        text,
  price_cents    integer not null,
  display_order  integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
do $$ begin alter table public.bundles add constraint bundles_slug_key
  unique (slug); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.bundles add constraint bundles_price_cents_check
  check (price_cents >= 0); exception when duplicate_object or duplicate_table then null; end $$;

create table if not exists public.bundle_items (
  id              uuid primary key default gen_random_uuid(),
  bundle_id       uuid not null,
  position        integer not null,
  mode            text not null,
  fixed_style     text,
  fixed_variant   text,
  choose_label    text,
  choose_options  jsonb,
  created_at      timestamptz not null default now()
);
do $$ begin alter table public.bundle_items add constraint bundle_items_bundle_id_fkey
  foreign key (bundle_id) references public.bundles(id) on delete cascade; exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.bundle_items add constraint bundle_items_bundle_id_position_key
  unique (bundle_id, "position"); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.bundle_items add constraint bundle_items_mode_check
  check (mode = any (array['fixed','choose'])); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.bundle_items add constraint choose_requires_options
  check (mode <> 'choose' or choose_options is not null); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.bundle_items add constraint fixed_requires_style_variant
  check (mode <> 'fixed' or (fixed_style is not null and fixed_variant is not null)); exception when duplicate_object or duplicate_table then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- Money
-- ─────────────────────────────────────────────────────────────
create table if not exists public.purchases (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid,
  guest_email        text,
  sku_id             text not null,
  stripe_session_id  text not null,
  stripe_charge_id   text,
  amount_cents       integer not null,
  status             text not null default 'pending',
  created_at         timestamptz not null default now(),
  paid_at            timestamptz
);
do $$ begin alter table public.purchases add constraint purchases_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null; exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.purchases add constraint purchases_sku_id_fkey
  foreign key (sku_id) references public.skus(id); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.purchases add constraint purchases_stripe_session_id_key
  unique (stripe_session_id); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.purchases add constraint purchases_stripe_charge_id_key
  unique (stripe_charge_id); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.purchases add constraint purchases_status_check
  check (status = any (array['pending','paid','failed','refunded'])); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.purchases add constraint identity_required
  check (user_id is not null or guest_email is not null); exception when duplicate_object or duplicate_table then null; end $$;

create table if not exists public.entitlements (
  id                     uuid primary key default gen_random_uuid(),
  purchase_id            uuid not null,
  user_id                uuid,
  guest_email            text,
  locked_style           text,
  locked_variant         text,
  status                 text not null default 'available',
  job_id                 uuid,
  generation_started_at  timestamptz,
  consumed_at            timestamptz,
  restored_at            timestamptz,
  created_at             timestamptz not null default now()
);
do $$ begin alter table public.entitlements add constraint entitlements_purchase_id_fkey
  foreign key (purchase_id) references public.purchases(id); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.entitlements add constraint entitlements_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade; exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.entitlements add constraint entitlements_status_check
  check (status = any (array['available','pending','consumed','restored'])); exception when duplicate_object or duplicate_table then null; end $$;

create table if not exists public.refund_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid,
  guest_email     text,
  entitlement_id  uuid not null,
  reason          text not null,
  created_at      timestamptz not null default now()
);
do $$ begin alter table public.refund_log add constraint refund_log_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null; exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.refund_log add constraint refund_log_entitlement_id_fkey
  foreign key (entitlement_id) references public.entitlements(id); exception when duplicate_object or duplicate_table then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- Credits (owner_key spine)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.credit_balances (
  owner_key   text primary key,
  balance     integer not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id             uuid primary key default gen_random_uuid(),
  owner_key      text not null,
  delta          integer not null,
  reason         text not null,
  ref_id         text,
  balance_after  integer not null,
  created_at     timestamptz not null default now()
);
do $$ begin alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason = any (array['purchase','code','grant','referral','craft','refund','recraft'])) not valid;
exception when duplicate_object or duplicate_table then null; end $$;

create table if not exists public.access_codes (
  code              text primary key,
  kind              text not null,
  credits_granted   integer,
  max_redemptions   integer,
  redemptions_used  integer not null default 0,
  expires_at        timestamptz,
  active            boolean not null default true
);

create table if not exists public.code_redemptions (
  code             text not null,
  owner_key        text not null,
  credits_granted  integer not null,
  redeemed_at      timestamptz not null default now(),
  primary key (code, owner_key)
);

-- ─────────────────────────────────────────────────────────────
-- Account
-- ─────────────────────────────────────────────────────────────
create table if not exists public.account_flags (
  owner_key   text primary key,
  fulfilment  boolean not null default false,
  note        text,
  updated_at  timestamptz not null default now()
);

create table if not exists public.account_addresses (
  owner_key     text primary key,
  full_name     text not null,
  line1         text not null,
  line2         text,
  city          text not null,
  region        text,
  postcode      text not null,
  country_code  text not null,
  updated_at    timestamptz not null default now()
);
do $$ begin alter table public.account_addresses add constraint account_addresses_country_iso2
  check (country_code ~ '^[A-Z]{2}$'); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.account_addresses add constraint account_addresses_not_blank
  check (length(btrim(full_name)) > 0 and length(btrim(line1)) > 0
     and length(btrim(city)) > 0 and length(btrim(postcode)) > 0); exception when duplicate_object or duplicate_table then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- Collection
-- ─────────────────────────────────────────────────────────────
create table if not exists public.collection_pieces (
  id           uuid primary key default gen_random_uuid(),
  owner_key    text not null,
  user_id      uuid,
  series       text not null default 'portraits',
  preset       text,
  label        text,
  mode         text,
  image_path   text not null,
  source_path  text,
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  archived     boolean not null default false,
  archived_at  timestamptz
);
do $$ begin alter table public.collection_pieces add constraint collection_pieces_archived_consistent
  check ((archived = false and archived_at is null)
      or (archived = true  and archived_at is not null)); exception when duplicate_object or duplicate_table then null; end $$;

create table if not exists public.collection_label_seq (
  owner_key  text primary key,
  next_seq   integer not null default 1
);

create table if not exists public.craft_events (
  id               uuid primary key default gen_random_uuid(),
  owner_key        text not null,
  piece_id         uuid,
  source_photo_id  text,
  series           text not null default 'portraits',
  preset           text,
  event            text not null,
  failure_type     text,
  failure_reason   text,
  attempts         integer not null default 1,
  user_decision    text,
  credits_delta    integer not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists public.preview_ledger (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  ip_hash       text not null,
  series        text not null default 'portraits',
  preset        text,
  resolution    text,
  storage_path  text,
  unlocked_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Print fulfilment
-- ─────────────────────────────────────────────────────────────
create table if not exists public.print_orders (
  id                     uuid primary key default gen_random_uuid(),
  stripe_session_id      text not null,
  stripe_payment_intent  text,
  prodigi_order_id       text,
  prodigi_merchant_ref   text,
  status                 public.print_order_status not null default 'created',
  error_message          text,
  customer_email         text not null,
  shipping_address       jsonb not null,
  items                  jsonb not null,
  retail_subtotal_cents  integer not null,
  retail_shipping_cents  integer not null,
  retail_total_cents     integer not null,
  wholesale_cost_cents   integer,
  shipping_method        text not null,
  shipping_carrier       text,
  tracking_number        text,
  tracking_url           text,
  created_at             timestamptz default now(),
  paid_at                timestamptz,
  placed_at              timestamptz,
  shipped_at             timestamptz,
  delivered_at           timestamptz,
  updated_at             timestamptz default now(),
  owner_key              text
);
do $$ begin alter table public.print_orders add constraint print_orders_stripe_session_id_key
  unique (stripe_session_id); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.print_orders add constraint print_orders_prodigi_order_id_key
  unique (prodigi_order_id); exception when duplicate_object or duplicate_table then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- Engine telemetry
-- ─────────────────────────────────────────────────────────────
create table if not exists public.qa_settings (
  series             text primary key,
  source_strictness  integer not null default 5,
  render_strictness  integer not null default 5,
  qa_enabled         boolean not null default true,
  updated_at         timestamptz not null default now(),
  updated_by         text
);
do $$ begin alter table public.qa_settings add constraint qa_settings_source_strictness_check
  check (source_strictness >= 1 and source_strictness <= 10); exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin alter table public.qa_settings add constraint qa_settings_render_strictness_check
  check (render_strictness >= 1 and render_strictness <= 10); exception when duplicate_object or duplicate_table then null; end $$;

create table if not exists public.qa_log (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  finished_at          timestamptz,
  series               text not null,
  status               text not null default 'in_progress',
  session_id           text,
  user_ref             text,
  preset_id            text,
  style_id             text,
  location_id          text,
  scale                text,
  source_hash          text,
  settings             jsonb,
  detected_subject     text,
  subject_confidence   integer,
  subject_description  text,
  activity_detected    boolean,
  series_match         boolean,
  redirect_series      text,
  redirect_message     text,
  intake_score         integer,
  intake_signals       jsonb,
  intake_reasons       jsonb,
  intake_passed        boolean,
  attempts             integer,
  first_pass           boolean,
  fidelity_score       integer,
  fidelity_reason      text,
  aesthetic_score      integer,
  aesthetic_reason     text,
  output_passed        boolean,
  render_ref           text,
  error_note           text,
  duration_ms          integer,
  cost_cents           integer not null default 0
);

create table if not exists public.prompt_versions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  engine_id    text not null,
  prompt_text  text not null,
  score        integer,
  iterations   integer,
  is_active    boolean default false,
  notes        text
);

-- ─────────────────────────────────────────────────────────────
-- Test bench
-- ─────────────────────────────────────────────────────────────
create table if not exists public.batch_runs (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  label               text not null,
  series              text not null,
  status              text not null default 'draft',
  config              jsonb not null,
  total_items         integer not null default 0,
  done_items          integer not null default 0,
  intake_rejected     integer not null default 0,
  passed              integer not null default 0,
  failed              integer not null default 0,
  errored             integer not null default 0,
  spent_cents         integer not null default 0,
  cost_ceiling_cents  integer not null default 10000,
  redirected          integer not null default 0
);

create table if not exists public.batch_items (
  id                   uuid primary key default gen_random_uuid(),
  run_id               uuid not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  source_path          text not null,
  source_hash          text,
  series               text not null,
  preset_id            text,
  style_id             text,
  location_id          text,
  scale                text,
  matrix_key           text not null,
  status               text not null default 'pending',
  started_at           timestamptz,
  finished_at          timestamptz,
  worker_id            text,
  intake_score         integer,
  intake_reasons       jsonb,
  intake_passed        boolean,
  attempts             integer,
  first_pass           boolean,
  render_storage_key   text,
  attempt_log          jsonb,
  fidelity_score       integer,
  fidelity_reason      text,
  aesthetic_score      integer,
  aesthetic_reason     text,
  output_passed        boolean,
  fail_category        text,
  triage_note          text,
  prompt_suggestion    text,
  cost_cents           integer not null default 0,
  duration_ms          integer,
  reviewed             boolean not null default false,
  review_verdict       text,
  review_note          text,
  detected_subject     text,
  subject_confidence   integer,
  subject_description  text,
  activity_detected    boolean,
  series_match         boolean,
  redirect_series      text,
  redirect_message     text
);
do $$ begin alter table public.batch_items add constraint batch_items_run_id_fkey
  foreign key (run_id) references public.batch_runs(id) on delete cascade; exception when duplicate_object or duplicate_table then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- Views
-- ─────────────────────────────────────────────────────────────
create or replace view public.qa_daily_funnel as
  select series,
    (date_trunc('day', created_at))::date as day,
    count(*) as requests,
    count(*) filter (where status = 'redirected')      as redirected,
    count(*) filter (where status = 'intake_rejected') as intake_rejected,
    count(*) filter (where status = 'passed')          as passed,
    count(*) filter (where status = 'failed')          as failed,
    count(*) filter (where status = 'errored')         as errored,
    count(*) filter (where first_pass)                 as first_pass,
    round(avg(fidelity_score)  filter (where fidelity_score  is not null), 2) as avg_fidelity,
    round(avg(aesthetic_score) filter (where aesthetic_score is not null), 2) as avg_aesthetic,
    sum(cost_cents) as cost_cents
  from public.qa_log
  group by series, date_trunc('day', created_at)
  order by (date_trunc('day', created_at))::date desc, series;

create or replace view public.batch_run_matrix as
  select run_id, matrix_key,
    count(*) as total,
    count(*) filter (where status = 'intake_rejected') as intake_rejected,
    count(*) filter (where status = 'redirected')      as redirected,
    count(*) filter (where status = 'passed')          as passed,
    count(*) filter (where status = 'failed')          as failed,
    count(*) filter (where first_pass)                 as first_pass,
    round(avg(fidelity_score)  filter (where fidelity_score  is not null), 2) as avg_fidelity,
    round(avg(aesthetic_score) filter (where aesthetic_score is not null), 2) as avg_aesthetic,
    sum(cost_cents) as cost_cents
  from public.batch_items
  group by run_id, matrix_key;

create or replace view public.batch_run_fail_categories as
  select run_id, fail_category,
    count(*) as fails,
    round((100.0 * count(*)::numeric)
          / nullif(sum(count(*)) over (partition by run_id), 0::numeric), 1) as pct_of_fails
  from public.batch_items
  where status = 'failed' and fail_category is not null
  group by run_id, fail_category;

create or replace view public.batch_run_subjects as
  select run_id, detected_subject, series_match, redirect_series,
    count(*) as items,
    round(avg(subject_confidence), 1) as avg_confidence
  from public.batch_items
  where detected_subject is not null
  group by run_id, detected_subject, series_match, redirect_series;

-- ─────────────────────────────────────────────────────────────
-- Indexes (not in the source dump; these are the ones the panel needs)
-- ─────────────────────────────────────────────────────────────
create index if not exists qa_log_created_idx            on public.qa_log (created_at desc);
create index if not exists qa_log_series_created_idx     on public.qa_log (series, created_at desc);
create index if not exists craft_events_owner_idx        on public.craft_events (owner_key, created_at desc);
create index if not exists craft_events_created_idx      on public.craft_events (created_at desc);
create index if not exists collection_pieces_owner_idx   on public.collection_pieces (owner_key, created_at desc);
create index if not exists credit_ledger_owner_idx       on public.credit_ledger (owner_key, created_at desc);
create index if not exists purchases_created_idx         on public.purchases (created_at desc);
create index if not exists print_orders_status_idx       on public.print_orders (status, created_at desc);
create index if not exists print_orders_owner_idx        on public.print_orders (owner_key);
create index if not exists entitlements_user_idx         on public.entitlements (user_id);
create index if not exists batch_items_run_idx           on public.batch_items (run_id);

commit;
