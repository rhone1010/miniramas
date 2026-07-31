-- 011_credit_skus.sql
-- Credit blocks as purchasable SKUs, and the function that lands a payment
-- in the ledger. Written by CUI V23 2026-07-31; Rich reviews and runs.
--
-- WHY THIS EXISTS
--   009 gave us spend_credits and redeem_code. Nothing GRANTS credits from a
--   purchase — redeem_code does its granting inline and only for codes. A
--   Stripe payment currently has nowhere to land. That is this file.
--
--   The five blocks are ruled in COMMERCE-AND-IDENTITY §2 and priced in the
--   Stripe test catalogue. The ladder belongs to the purchase and nowhere
--   else: an image costs 10 credits whether it is the first or the thirtieth.

-- ── 1 · widen the kind constraint ────────────────────────────
-- 003 wrote: check (kind in ('single', 'bundle')). Both are preview-then-
-- unlock, which credits superseded on 2026-07-27. They stay because /store
-- still reads them; 'credits' joins them rather than replacing them.

alter table skus drop constraint if exists skus_kind_check;
alter table skus add constraint skus_kind_check
  check (kind in ('single', 'bundle', 'credits'));

-- ── 2 · grant_credits ────────────────────────────────────────
-- The mirror of spend_credits. Atomic, and IDEMPOTENT BY ref_id, because a
-- Stripe webhook retries for three days and a replayed delivery must not
-- credit an account twice.
--
-- Returns the balance. If this ref_id has already been granted the balance
-- is returned unchanged and nothing is written — the caller cannot tell the
-- difference, which is the point.

create or replace function grant_credits(
  p_owner  text,
  p_n      int,
  p_reason text,
  p_ref    text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare newbal int;
begin
  if p_n <= 0 then
    raise exception 'grant_credits: p_n must be positive, got %', p_n;
  end if;

  -- Idempotency. A ledger row with this reason and ref means the money has
  -- already been counted. Return the current balance and stop.
  if p_ref is not null and exists (
    select 1 from credit_ledger
     where owner_key = p_owner and reason = p_reason and ref_id = p_ref
  ) then
    select balance into newbal from credit_balances where owner_key = p_owner;
    return coalesce(newbal, 0);
  end if;

  insert into credit_balances (owner_key, balance) values (p_owner, p_n)
    on conflict (owner_key)
    do update set balance = credit_balances.balance + p_n, updated_at = now()
    returning balance into newbal;

  insert into credit_ledger (owner_key, delta, reason, ref_id, balance_after)
    values (p_owner, p_n, p_reason, p_ref, newbal);

  return newbal;
end;
$$;

-- ── 3 · the five blocks ──────────────────────────────────────
-- count = CREDITS, not images. 10 credits is one image; the SKU stores what
-- is bought, and the workshop divides. price_cents matches the Stripe price
-- exactly — if the two ever disagree Stripe wins, because Stripe is what
-- charged the customer.
--
-- All five price ids verified against the Stripe test catalogue export
-- 2026-07-31: amounts correct, USD, one-off, none recurring.
--
-- NOTE ON THE 300 ROW. It was first created at $82.32 and corrected to
-- $82.34 while keeping the same price id, which Stripe normally does not
-- permit — prices are immutable once used. It had never been used, so the
-- edit was allowed. If a test checkout ever charges $82.32, this is why:
-- check the price object rather than the dashboard's product summary.

insert into skus (id, display_name, kind, count, price_cents, stripe_price_id, active) values
  ('credits_10',  'Liten & Co - 10 Credits',  'credits',  10,  499, 'price_1TzJ5MCWHIffAtyWxFR0uHH6', true),
  ('credits_30',  'Liten & Co - 30 Credits',  'credits',  30, 1272, 'price_1TzJ5ZCWHIffAtyW3v93EUdb', true),
  ('credits_60',  'Liten & Co - 60 Credits',  'credits',  60, 2246, 'price_1TzJ5oCWHIffAtyWsDguFKev', true),
  ('credits_120', 'Liten & Co - 120 Credits', 'credits', 120, 3892, 'price_1TzJ61CWHIffAtyWfFtFIrCf', true),
  ('credits_300', 'Liten & Co - 300 Credits', 'credits', 300, 8234, 'price_1TzJ6GCWHIffAtyW1j55w2XL', true)
on conflict (id) do update set
  display_name    = excluded.display_name,
  kind            = excluded.kind,
  count           = excluded.count,
  price_cents     = excluded.price_cents,
  stripe_price_id = excluded.stripe_price_id,
  active          = excluded.active;

-- ── 4 · verification ─────────────────────────────────────────
-- Run these after. Every one should come back as described.

-- five rows, kind='credits', ascending
--   select id, count, price_cents, stripe_price_id from skus
--    where kind = 'credits' order by count;

-- every price id is a real Stripe price, none blank
--   select count(*) from skus where kind='credits' and stripe_price_id !~ '^price_';  -- expect 0

-- grant is idempotent: run twice, balance moves once
--   select grant_credits('test-owner', 60, 'purchase', 'cs_test_idempotency');
--   select grant_credits('test-owner', 60, 'purchase', 'cs_test_idempotency');
--   select balance from credit_balances where owner_key = 'test-owner';   -- expect 60
--   select count(*) from credit_ledger where ref_id = 'cs_test_idempotency';  -- expect 1
--   delete from credit_ledger   where owner_key = 'test-owner';
--   delete from credit_balances where owner_key = 'test-owner';

-- ── 5 · SEPARATE FINDING, NOT FIXED HERE ─────────────────────
-- 009 line 118: redeem_code grants coalesce(c.credits_granted, 0). RHONE3166
-- is seeded with credits_granted = null, so it grants ZERO. The comment says
-- "unlimited handled at spend time" — but spend_credits has no admin path.
-- It decrements and returns -1 when the balance is short. Nothing else.
--
-- So on 009 as written, the admin code redeems successfully and then cannot
-- craft. That matches the symptom reported on 7/27 and contradicts the 7/28
-- carryover's conclusion that the bug may not exist.
--
-- 010 may already have changed this — it is not in front of me. VERIFY
-- AGAINST 010 BEFORE ACTING. If the gap is real the fix is a branch in
-- spend_credits for an unlimited owner, not a large balance, because a
-- number can be spent to zero and admin should not be.
