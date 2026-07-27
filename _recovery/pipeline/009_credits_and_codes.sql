-- 009_credits_and_codes.sql
-- Credits & codes (CREDITS-AND-CODES-SPEC-v3, 2026-07-23). One balance per
-- account, one append-only ledger. Codes are a funding source INTO the same
-- ledger — not a bypass. Aug 1 runs the real plumbing with Stripe disabled.
--
-- Money movements are done through the two SECURITY-atomic functions at the
-- bottom (spend_credits, redeem_code) so concurrent crafts / double-clicks
-- can't oversell or double-grant. Routes call them via supabase.rpc().

-- ── Tables ───────────────────────────────────────────────────
create table if not exists credit_balances (
  owner_key  text primary key,                 -- auth user id, else guest token
  balance    int  not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists credit_ledger (     -- append-only, every movement
  id            uuid primary key default gen_random_uuid(),
  owner_key     text not null,
  delta         int  not null,                  -- +/-
  reason        text not null,                  -- purchase|code|grant|referral|craft|refund
  ref_id        text,                           -- code / stripe id / piece id / craft_event id
  balance_after int  not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_credit_ledger_owner on credit_ledger (owner_key, created_at desc);

create table if not exists access_codes (
  code             text primary key,
  kind             text not null,               -- admin|tester|promo|referral|unlock
  credits_granted  int,                          -- null = unlimited (admin only)
  max_redemptions  int,                          -- null = unlimited total
  redemptions_used int  not null default 0,
  expires_at       timestamptz,
  active           boolean not null default true
);

create table if not exists code_redemptions (   -- prevents double-redeem; PK = idempotency
  code            text not null,
  owner_key       text not null,
  credits_granted int  not null,
  redeemed_at     timestamptz not null default now(),
  primary key (code, owner_key)
);

alter table credit_balances   enable row level security;
alter table credit_ledger     enable row level security;
alter table access_codes      enable row level security;
alter table code_redemptions  enable row level security;
-- No policies: service-role only, via the /api/v1/credits/* routes.

-- ── Aug 1 seed (idempotent) ──────────────────────────────────
insert into access_codes (code, kind, credits_granted, max_redemptions, active) values
  ('RHONE3166',    'admin',  null, null, true),   -- unlimited, never depletes, Rich only
  ('TESTER-AMBER', 'tester', 50,   200,  true),
  ('TESTER-BRASS', 'tester', 50,   200,  true),
  ('TESTER-CEDAR', 'tester', 50,   200,  true),
  ('TESTER-DELTA', 'tester', 50,   200,  true),
  ('TESTER-ELDER', 'tester', 50,   200,  true),
  ('TESTER-FLINT', 'tester', 50,   200,  true),
  ('TESTER-GROVE', 'tester', 50,   200,  true),
  ('TESTER-HAVEN', 'tester', 50,   200,  true),
  ('TESTER-IVORY', 'tester', 50,   200,  true),
  ('TESTER-JASPER','tester', 50,   200,  true)
on conflict (code) do nothing;

-- ── Atomic spend. Conditional decrement is race-safe (row lock + balance>=n
--    re-check). Returns the new balance, or -1 if insufficient. ────────────
create or replace function spend_credits(p_owner text, p_n int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare b int;
begin
  update credit_balances
     set balance = balance - p_n, updated_at = now()
   where owner_key = p_owner and balance >= p_n
   returning balance into b;
  if b is null then return -1; end if;   -- insufficient (or no balance row)
  return b;
end;
$$;

-- ── Atomic, idempotent code redemption. code_redemptions PK guarantees
--    one-per-account even under concurrency. Returns a jsonb result. ────────
create or replace function redeem_code(p_code text, p_owner text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c access_codes%rowtype; granted int; newbal int;
begin
  select * into c from access_codes where code = p_code;
  if not found or not c.active then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if exists (select 1 from code_redemptions where code = p_code and owner_key = p_owner) then
    return jsonb_build_object('ok', true, 'already', true);   -- idempotent, no double grant
  end if;
  if c.max_redemptions is not null and c.redemptions_used >= c.max_redemptions then
    return jsonb_build_object('ok', false, 'reason', 'exhausted');
  end if;

  granted := coalesce(c.credits_granted, 0);   -- admin (null) grants 0; unlimited handled at spend time
  insert into code_redemptions (code, owner_key, credits_granted) values (p_code, p_owner, granted);
  update access_codes set redemptions_used = redemptions_used + 1 where code = p_code;
  insert into credit_balances (owner_key, balance) values (p_owner, granted)
    on conflict (owner_key) do update set balance = credit_balances.balance + granted, updated_at = now()
    returning balance into newbal;
  insert into credit_ledger (owner_key, delta, reason, ref_id, balance_after)
    values (p_owner, granted, 'code', p_code, newbal);
  return jsonb_build_object('ok', true, 'granted', granted, 'balance', newbal, 'kind', c.kind);
end;
$$;
