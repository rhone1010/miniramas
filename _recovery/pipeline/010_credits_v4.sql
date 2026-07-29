-- 010_credits_v4.sql
-- CUI V22 · 2026-07-28 · written for review, not applied.
--
-- Brings the credits plumbing to CREDITS-AND-CODES-SPEC-v4. 009 was written
-- against v3, when an image cost one credit. Under v4 an image costs ten, and
-- two things in 009 are now wrong by that measure.
--
-- It also adds refund_credits, which 009 never had. /api/v1/credits/refund is
-- currently read-then-write and will oversell under concurrency.
--
-- NOTHING HERE IS DESTRUCTIVE. It updates two seeded rows and creates one
-- function. Safe to run twice.
--
-- REVIEW BEFORE RUNNING. Never against production first — PROCEDURES §7.

begin;

-- ── 1 · Tester grants · 50 → 500 ─────────────────────────────────────────
-- 009 seeded testers at 50 credits, correct when an image cost 1. Under v4
-- that is five images, not fifty. LOCKED-DECISIONS: "Tester grant: 500
-- credits = 50 images each."
--
-- Only rows still holding the old figure are touched, so a code already
-- adjusted by hand is left alone.
update access_codes
   set credits_granted = 500
 where kind = 'tester'
   and credits_granted = 50;

-- ── 2 · Atomic refund ────────────────────────────────────────────────────
-- The mirror of spend_credits. Same shape deliberately: one statement, row
-- lock, returns the new balance. The route must stop doing this in two steps.
--
-- p_n is CREDITS, not images — as with spend_credits. A refunded image is
-- p_n = 10.
create or replace function refund_credits(p_owner text, p_n int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare b int;
begin
  if p_n <= 0 then return -1; end if;

  insert into credit_balances (owner_key, balance)
       values (p_owner, p_n)
  on conflict (owner_key) do update
       set balance = credit_balances.balance + p_n,
           updated_at = now()
    returning balance into b;

  return b;
end;
$$;

-- ── 3 · Ledger reasons ───────────────────────────────────────────────────
-- 009's comment lists the vocabulary but nothing enforces it, so a typo in a
-- route writes a reason nobody can query later. The constraint is added
-- NOT VALID so existing rows are never rejected on the way in.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'credit_ledger_reason_check'
  ) then
    alter table credit_ledger
      add constraint credit_ledger_reason_check
      check (reason in ('purchase','code','grant','referral','craft','refund','recraft'))
      not valid;
  end if;
end $$;

commit;

-- ── Verify ───────────────────────────────────────────────────────────────
-- Run these after applying. Expected results in the comments.
--
--   select code, kind, credits_granted from access_codes order by kind, code;
--     → RHONE3166 admin null · every TESTER-* tester 500
--
--   select proname from pg_proc where proname in ('spend_credits','refund_credits','redeem_code');
--     → all three
--
-- Then, against a test owner:
--   select redeem_code('TESTER-AMBER','test-owner');
--     → {"ok":true,"granted":500,"balance":500,"kind":"tester"}
--   select spend_credits('test-owner', 50);        -- five images at ten credits
--     → 450
--   select refund_credits('test-owner', 10);       -- one image back
--     → 460
--   select delta, reason, balance_after from credit_ledger
--    where owner_key = 'test-owner' order by created_at;
--
-- NOTE: spend_credits writes no ledger row — the route does that. If a spend
-- succeeds and the route then fails, the balance moves and the ledger does
-- not. That is a real gap and it is NOT fixed here; fixing it properly means
-- moving the ledger write inside the function, which changes the route's
-- contract. Flagged for a ruling.
