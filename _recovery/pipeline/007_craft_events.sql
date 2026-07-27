-- 007_craft_events.sql
-- Append-only audit of every craft attempt and the customer's remedy choice.
-- (CLAW reconciliation 2026-07-23 §2.3.) Today `user_decision` lives only in
-- client state and never reaches the server; only successful pieces persist, so
-- failures, attempts, failure reasons and remedy choices evaporate on reload.
-- With credits live that is unrecorded money movement — this table is the record
-- of truth for dispute evidence and the real failure rate across the test.
--
-- Identity mirrors collection_pieces: owner_key = auth user id when signed in,
-- else the stable per-browser guest token. Written on craft start, craft resolve,
-- and every user decision. APPEND-ONLY — rows are never updated or deleted; a
-- decision that changes state writes a NEW row.
--
-- NOTE (blocked): credits_delta is included so a credit-moving decision can be
-- recorded, but the rule "any decision moving credits must also write a
-- credit_ledger row, and the two must reconcile" depends on
-- CREDITS-AND-CODES-SPEC-v2 (not yet delivered). Until then, non-credit events
-- (craft_started / craft_succeeded / craft_failed / redirected / intake_rejected)
-- can be written with credits_delta = 0; the credit_ledger tie lands with the money lane.

create table if not exists craft_events (
  id              uuid primary key default gen_random_uuid(),
  owner_key       text not null,                     -- auth user id OR guest token (mirrors collection_pieces)
  piece_id        uuid,                              -- collection_pieces.id once a piece exists (null pre-persist)
  source_photo_id text,                              -- stable id of the uploaded source (groups a photo's attempts)
  series          text not null default 'portraits',
  preset          text,                              -- material/effect id
  event           text not null,                     -- 'craft_started' | 'craft_succeeded' | 'craft_failed' | 'redirected' | 'intake_rejected'
  failure_type    text,                              -- 'timeout' | 'fatal_error' | 'likeness_fail' | null
  failure_reason  text,                              -- engine final_reason (free text)
  attempts        int  not null default 1,           -- attempt number for this source+config
  user_decision   text,                              -- 'recraft' | 'credit' | 'refund' | 'accept' | null
  credits_delta   int  not null default 0,           -- credits moved by this event (+/-); reconciles with credit_ledger (money lane)
  created_at      timestamptz not null default now()
);

create index if not exists idx_craft_events_owner  on craft_events (owner_key, created_at desc);
create index if not exists idx_craft_events_piece  on craft_events (piece_id);
create index if not exists idx_craft_events_source on craft_events (source_photo_id);
create index if not exists idx_craft_events_event  on craft_events (event, created_at desc);

alter table craft_events enable row level security;
-- No policies on purpose: service-role only, same posture as collection_pieces.
-- The browser reaches this table through a server route that scopes every write
-- to the caller's owner_key. Append-only is enforced at the route (insert only).
