-- 005_preview_ledger.sql
-- Free-preview enforcement + clean-original retention.
--
-- One free preview per email AND per IP, both enforced server-side.
-- A row is written only after a preview piece successfully renders
-- (a gate bounce or render failure never spends the preview).
-- The clean (un-watermarked) original is retained in the private
-- 'previews' bucket keyed by preview id; the unlock purchase
-- re-delivers it via /api/v1/portraits/unlock.

create table if not exists preview_ledger (
  id            uuid primary key default gen_random_uuid(),  -- the preview id
  email         text not null,                               -- normalized lower(trim())
  ip_hash       text not null,                               -- sha256 of caller IP
  series        text not null default 'portraits',
  preset        text,                                        -- preset rendered for the preview
  resolution    text,                                        -- '1k' etc.
  storage_path  text,                                        -- clean original in 'previews' bucket
  unlocked_at   timestamptz,                                 -- stamped on successful unlock
  created_at    timestamptz not null default now()
);

-- ONE per email and ONE per IP — both unique. A second attempt from the
-- same household IP is denied even under a fresh email (anti-abuse, per spec).
create unique index if not exists uq_preview_ledger_email   on preview_ledger (email);
create unique index if not exists uq_preview_ledger_ip_hash on preview_ledger (ip_hash);
create index        if not exists idx_preview_ledger_created on preview_ledger (created_at desc);

alter table preview_ledger enable row level security;
-- No policies on purpose: service-role only. Browsers never touch this table.

-- Private bucket for clean originals. All access is service-role.
insert into storage.buckets (id, name, public)
values ('previews', 'previews', false)
on conflict (id) do nothing;
