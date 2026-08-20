-- supabase/migrations/0xx_groups_retry_tokens.sql
--
-- THE FREE RETRY.
--
-- When a Groups craft misses the likeness gate after four attempts, the
-- customer is offered one more run at no cost — but only if the INPUTS
-- CHANGE.
--
-- ── WHY FREE ───────────────────────────────────────────────────────────
--
-- The four attempts are already paid for by the studio; that cost is sunk
-- the moment the gate fails. Charging again for a fifth attempt on the same
-- inputs would be charging twice for the same failure.
--
-- A changed input is genuinely different work, and it is the thing most
-- likely to succeed — so it is worth four more attempts of the studio's
-- money to turn a refund into a sale.
--
-- ── WHY IT IS GATED ON CHANGED INPUTS ──────────────────────────────────
--
-- Ungated, this is a reroll button: press until the dice land. Gated, it is
-- the only lever that actually improves the odds, and it makes the offer
-- honest — the Curator is asking the customer to DO something, not to try
-- again and hope.
--
--   some_figures  -> a closer photograph of whoever did not hold. The
--                    pipeline takes up to 14 sources, so this is a real
--                    second attempt rather than a reroll.
--   most_figures  -> a different effect. The photograph is not the problem;
--                    some treatments simply do not carry a crowd.
--
-- ── ONCE ───────────────────────────────────────────────────────────────
--
-- A second failure WITH a better photograph means the photograph was never
-- the problem, and at that point the refund is the right answer and the
-- Curator should say so plainly rather than asking for a third go.
--
-- ── WHY A TABLE AND NOT A SIGNED TOKEN ─────────────────────────────────
--
-- A signed value in the response needs no migration and is stateless, which
-- is exactly the problem: nothing records that a retry was granted, so
-- nothing can answer "how often does this fire" or "did this customer get
-- two". Free renders are a cost line. A cost line that leaves no trace is
-- one nobody can reason about later.
--
-- It is also the difference between a token and a claim. A row can be
-- marked redeemed inside the same transaction that redeems it.

create table if not exists public.groups_retry_tokens (
  id            uuid primary key default gen_random_uuid(),
  owner_key     text        not null,

  -- The charge this retry belongs to. Matches credit_ledger.ref_id, so a
  -- retry can always be traced back to the craft that earned it and to the
  -- refund that may follow.
  ref_id        text        not null,

  effect_id     text        not null,
  subject_count integer     not null,

  -- What the customer must change for the retry to be valid. From
  -- GroupsFailure.kind on the craft that failed.
  --   'some_figures' -> must add at least one source photograph
  --   'most_figures' -> must choose a different effect
  reason        text        not null
                check (reason in ('some_figures', 'most_figures')),

  -- Fingerprint of what was sent the first time, so "changed" can be
  -- proven rather than trusted. Source count for some_figures; the effect
  -- id is already above for most_figures.
  source_count  integer     not null,

  created_at    timestamptz not null default now(),
  redeemed_at   timestamptz,

  -- Unredeemed tokens do not live forever. Long enough to find a better
  -- photograph on a phone, short enough that this is not a standing
  -- entitlement.
  expires_at    timestamptz not null default (now() + interval '14 days')
);

-- ONE TOKEN PER CHARGE. This is the "once" rule, enforced by the database
-- rather than by whichever route remembers to check. A second failed craft
-- is a second ref_id and earns its own token; a second failure on the SAME
-- craft does not.
create unique index if not exists groups_retry_tokens_ref_idx
  on public.groups_retry_tokens (ref_id);

-- The lookup the redeem path makes.
create index if not exists groups_retry_tokens_owner_idx
  on public.groups_retry_tokens (owner_key, redeemed_at);

alter table public.groups_retry_tokens enable row level security;

-- ── REDEEM ─────────────────────────────────────────────────────────────
--
-- Returns true exactly once per token, and only when the inputs actually
-- changed. Everything is decided inside one statement against a locked row,
-- so two requests arriving together cannot both redeem it.
--
-- The caller passes what it is ABOUT to send, not what it sent before. This
-- function is the thing that decides whether that counts as a change.

create or replace function public.redeem_groups_retry(
  p_owner        text,
  p_ref_id       text,
  p_effect_id    text,
  p_source_count integer
)
returns table (allowed boolean, reason text)
language plpgsql
security definer
as $function$
declare
  t record;
begin
  select * into t
    from groups_retry_tokens
   where ref_id = p_ref_id
     and owner_key = p_owner
     for update;

  if t is null then
    return query select false, 'no_token';
    return;
  end if;

  if t.redeemed_at is not null then
    return query select false, 'already_redeemed';
    return;
  end if;

  if t.expires_at < now() then
    return query select false, 'expired';
    return;
  end if;

  -- The change test. This is the whole point of the token.
  if t.reason = 'some_figures' and p_source_count <= t.source_count then
    return query select false, 'no_new_photograph';
    return;
  end if;

  if t.reason = 'most_figures' and p_effect_id = t.effect_id then
    return query select false, 'same_effect';
    return;
  end if;

  update groups_retry_tokens
     set redeemed_at = now()
   where id = t.id;

  return query select true, t.reason;
end;
$function$;

-- ── WHAT THE ROUTE STILL HAS TO DO ─────────────────────────────────────
--
-- ISSUE: when generateGroupsRender returns passed:false with an image,
-- insert a row here using the ref_id the credit gate minted. Non-fatal — a
-- token that failed to write costs the studio a conversion, not the
-- customer a craft.
--
-- REDEEM: call redeem_groups_retry BEFORE the credit gate, not after. A
-- true return means skip the gate entirely. A false return means fall
-- through to a normal paid craft, and the `reason` says why so the Curator
-- can be honest about it — "that is the same photograph" is a different
-- sentence from "you have used this one".
--
-- REFUND: taking the credits back and using the retry are EXCLUSIVE. Rich,
-- 19 August. If a refund is issued against a ref_id, the token for that
-- ref_id must be marked redeemed in the same transaction, or the customer
-- has their money and a free render.
