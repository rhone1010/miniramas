-- supabase/migrations/0xx_credit_sweep.sql
--
-- THE SWEEP.
--
-- When a balance is above zero but short of the price, and the shortfall is
-- smaller than the cheapest thing in the shop, the spend succeeds and the
-- balance goes to zero. Never below zero. Once per block of credits.
--
-- ── WHY ────────────────────────────────────────────────────────────────
--
-- Credits are sold in blocks and priced per craft, so balances strand. A
-- customer with 8 credits looking at a 10-credit piece has money in the
-- shop that can buy nothing, and the shop's answer is "buy more" at the
-- exact moment they were ready to spend.
--
-- Refunds were considered and refused. A forty-cent Stripe refund costs
-- the fee, adds a reconciliation line, and tells the customer their money
-- is safer out of the shop than in it.
--
-- ── WHY IT IS NOT EXPLOITABLE ──────────────────────────────────────────
--
-- Reaching a stranded balance costs a block purchase. The gift is capped
-- at a few credits. It is once per block. Unlike a system where the
-- precondition can be manufactured for free, here the precondition IS a
-- purchase.
--
-- ── WHY THIS IS A NEW FUNCTION AND NOT AN EDIT ─────────────────────────
--
-- spend_credits is four lines, correct, and called from the craft gate,
-- studio/keep and anything added since. Its contract is "returns the new
-- balance, or -1". A sweep breaks that contract: the caller needs to know
-- how much was ACTUALLY taken, because the ledger row must say -8 and not
-- -10, and a returned balance of 0 cannot distinguish a sweep from an
-- exact spend.
--
-- So spend_credits is left alone and this is additive. Callers migrate one
-- at a time, deliberately, and anything not migrated behaves exactly as it
-- does today.

-- ── The threshold is server-side and not a parameter ───────────────────
--
-- Passing the cheapest price in would let a caller widen its own sweep,
-- which is the same hole the credit gate closes by refusing a client's
-- cost_per. The shop reads this value; it does not set it.
--
-- 4 credits is the Studio keep, the cheapest item as of 2026-08-19. If a
-- cheaper item is ever added, LOWER this — a threshold above the cheapest
-- price means someone can sweep into an item they could already afford.

create or replace function public.credit_sweep_threshold()
returns integer
language sql
immutable
as $function$ select 4 $function$;

-- ── Once per block ─────────────────────────────────────────────────────
--
-- credit_balances gains a flag rather than the function reading ledger
-- history. spend_credits writes no ledger row — the routes do — so a rule
-- that depended on the ledger would make that split a correctness problem
-- instead of an audit one.

alter table public.credit_balances
  add column if not exists sweep_used boolean not null default false;

-- Cleared whenever the balance goes UP, which is what "per block" means:
-- a purchase, a grant, a refund reversal. Done as a trigger so it cannot
-- be forgotten by whichever path adds the credits.

create or replace function public.reset_sweep_on_grant()
returns trigger
language plpgsql
as $function$
begin
  if new.balance > old.balance then
    new.sweep_used := false;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_reset_sweep_on_grant on public.credit_balances;

create trigger trg_reset_sweep_on_grant
  before update on public.credit_balances
  for each row
  execute function public.reset_sweep_on_grant();

-- ── The spend ──────────────────────────────────────────────────────────
--
-- Returns three values because the caller needs all three:
--
--   balance_after  what to write in the ledger row
--   spent          how much actually left the account — NOT p_n when a
--                  sweep fired, and the ledger must record what moved
--   swept          so the Curator can say something, once, at the moment
--                  it happens
--
-- balance_after of -1 with spent 0 is the refusal, matching spend_credits'
-- sentinel so a caller migrating from it reads the same signal.
--
-- The whole thing is one UPDATE with a guarded WHERE, so two concurrent
-- crafts cannot both sweep the same balance. Read-then-write would let
-- them.

create or replace function public.spend_credits_sweep(
  p_owner text,
  p_n     integer
)
returns table (balance_after integer, spent integer, swept boolean)
language plpgsql
security definer
as $function$
declare
  v_balance   integer;
  v_threshold integer := public.credit_sweep_threshold();
  v_used      boolean;
begin
  -- Lock the row. Everything below decides against a balance that cannot
  -- move underneath it.
  select balance, sweep_used
    into v_balance, v_used
    from credit_balances
   where owner_key = p_owner
     for update;

  if v_balance is null then
    return query select -1, 0, false;
    return;
  end if;

  -- The ordinary path. Nothing special, and no flag is touched.
  if v_balance >= p_n then
    update credit_balances
       set balance = balance - p_n, updated_at = now()
     where owner_key = p_owner
     returning balance into v_balance;
    return query select v_balance, p_n, false;
    return;
  end if;

  -- Short. A sweep needs all four conditions, and each one is a separate
  -- reason someone is not entitled to it:
  --
  --   balance above zero   there is something stranded to sweep
  --   shortfall small      it is a rounding gift, not a discount. Someone
  --                        holding 8 against an 18-credit Groups piece is
  --                        ten short and gets nothing
  --   not used this block  once per purchase
  if v_balance > 0
     and (p_n - v_balance) < v_threshold
     and not v_used
  then
    update credit_balances
       set balance    = 0,
           sweep_used = true,
           updated_at = now()
     where owner_key = p_owner
       and balance   = v_balance;   -- guard: nothing moved since the lock

    return query select 0, v_balance, true;
    return;
  end if;

  -- Short and not eligible. Same sentinel as spend_credits.
  return query select -1, 0, false;
end;
$function$;

-- ── What the caller still has to do ────────────────────────────────────
--
-- Write the ledger row using `spent`, NOT the price. A craft that swept 8
-- credits for a 10-credit piece is a -8 ledger row with balance_after 0.
-- Recording -10 would make the ledger disagree with the balance, and the
-- account page reads both.
--
-- Consider a distinct reason on the swept row — 'craft_swept' rather than
-- 'craft' — so the gift is countable later without inferring it from
-- arithmetic.
--
-- The Curator's line when it fires is Rich's, and it is not written here.
-- She should not announce the sweep in advance; it only exists at the
-- moment it happens.
