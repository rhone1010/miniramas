-- 031_generation_grants.sql
--
-- A Portraits craft pays for ONE clean image, once.
--
-- /api/v1/portraits/generate returned a clean image to anyone who asked for
-- one. The credit charge happened in a separate call (/credits/gate) that
-- generate never looked at, so the paywall was the order the browser made
-- its requests in -- skip the first call and the second was free.
--
-- A GRANT is the server's record that one image was paid for. /credits/gate
-- spends the credits and issues one grant per image in a single transaction.
-- generate refuses a browser request without a grant, claims it before any
-- NB2 work, and marks it consumed only once the clean result is persisted.
--
--   issued  --claim (before NB2)-->  claimed  --persisted + consumed-->  consumed
--     ^                                  |
--     +--- release: nothing delivered ---+
--   issued / stale claimed  --refund-->  refunded
--
-- THE INVARIANT: one grant produces at most one canonical delivered image.
-- The canonical result lives at a path derived from the grant id
-- (previews/portraits-grants/<id>.jpg) and is written with upsert off, so a
-- second render can never replace it; a retry that finds it re-delivers it.
--
-- ALSO IN THIS MIGRATION -- CREDIT MINTING, TWO WAYS.
--   1. grant_credits, refund_credits, spend_credits, spend_credits_sweep and
--      redeem_code are SECURITY DEFINER and were executable by anon and
--      authenticated. Supabase serves public functions at /rest/v1/rpc, and
--      the anon key ships in the browser bundle, so anyone could call
--      grant_credits or refund_credits for any owner with any amount. Every
--      legitimate caller uses the service role (verified 2026-09-10), so
--      execute is revoked from everything else.
--   2. The /credits/refund route is fixed in code alongside this.

-- ── the table ───────────────────────────────────────────────────────────
create table if not exists generation_grants (
  id           uuid        primary key default gen_random_uuid(),
  ref_id       text        not null,                   -- the gate's per-craft ref, shared by its units
  unit         smallint    not null check (unit >= 0), -- 0..n-1, in the order the presets were posted
  owner_key    text        not null,
  series       text        not null check (series = 'portraits'),
  preset       text        not null,                   -- a grant is only good for its own preset
  cost_credits integer     not null check (cost_credits >= 0),   -- 0 for an admin craft
  status       text        not null default 'issued'
               check (status in ('issued', 'claimed', 'consumed', 'refunded')),
  claim_token  uuid,                                   -- only the claimer may consume or release
  claimed_at   timestamptz,
  consumed_at  timestamptz,
  refunded_at  timestamptz,
  result_path  text,                                   -- the canonical result, for re-delivery
  attempts     integer     not null default 0,
  last_error   text,
  created_at   timestamptz not null default now(),
  unique (ref_id, unit)
);

create index if not exists idx_generation_grants_owner_ref
  on generation_grants (owner_key, ref_id);

-- Service role only, like every other money table here: RLS on, no policies.
alter table generation_grants enable row level security;

comment on table generation_grants is
  'One row per paid Portraits image. Issued by /credits/gate together with the spend; claimed by /portraits/generate before NB2; consumed only once the canonical result is persisted; refundable only if never delivered.';

-- ── spend and issue together ────────────────────────────────────────────
-- One transaction, so a spend with no grants cannot exist. Returns no rows
-- when the balance is short, and in that case nothing has been spent.
create or replace function issue_generation_grants(
  p_owner    text,
  p_ref      text,
  p_presets  text[],
  p_cost_per integer,
  p_charge   boolean
)
returns table (grant_id uuid, unit integer, preset text, balance_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n   integer := coalesce(array_length(p_presets, 1), 0);
  v_bal integer;
  v_i   integer;
  v_id  uuid;
begin
  if v_n < 1 then
    raise exception 'issue_generation_grants: at least one preset is required';
  end if;
  if p_cost_per is null or p_cost_per < 0 then
    raise exception 'issue_generation_grants: bad cost %', p_cost_per;
  end if;

  if p_charge then
    v_bal := spend_credits(p_owner, v_n * p_cost_per);
    if v_bal < 0 then
      return;                                   -- insufficient: no rows, nothing spent
    end if;
  else
    select b.balance into v_bal from credit_balances b where b.owner_key = p_owner;
    v_bal := coalesce(v_bal, 0);
  end if;

  for v_i in 1..v_n loop
    insert into generation_grants (ref_id, unit, owner_key, series, preset, cost_credits)
    values (p_ref, v_i - 1, p_owner, 'portraits', p_presets[v_i],
            case when p_charge then p_cost_per else 0 end)
    returning id into v_id;
    grant_id      := v_id;
    unit          := v_i - 1;
    preset        := p_presets[v_i];
    balance_after := v_bal;
    return next;
  end loop;
end;
$$;

-- ── refund only what was never delivered ────────────────────────────────
-- Idempotent. The caller's count is not an input: the grants decide.
--
-- A grant whose canonical result already exists in storage WAS delivered,
-- whatever its row says -- a consume write can fail after the result is
-- stored. Those are completed as consumed here, never refunded.
create or replace function refund_generation_grants(
  p_owner         text,
  p_ref           text,
  p_stale_seconds integer
)
returns table (
  refunded_units    integer,
  refunded_credits  integer,
  already_refunded  integer,
  delivered_units   integer,
  held_units        integer,
  balance_after     integer
)
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_units   integer := 0;
  v_credits integer := 0;
  v_bal     integer;
  v_cost    integer;
  v_costs   integer[];
  v_running integer;
  v_stale   timestamptz := now() - make_interval(secs => p_stale_seconds);
begin
  -- Lock this craft's grants so a concurrent claim or refund waits.
  perform 1 from generation_grants g
   where g.owner_key = p_owner and g.ref_id = p_ref
   for update;

  -- Delivered, whatever the row says.
  update generation_grants g
     set status = 'consumed',
         consumed_at = coalesce(g.consumed_at, now()),
         result_path = 'portraits-grants/' || g.id || '.jpg',
         claim_token = null
   where g.owner_key = p_owner and g.ref_id = p_ref
     and g.status in ('issued', 'claimed')
     and exists (select 1 from storage.objects o
                  where o.bucket_id = 'previews'
                    and o.name = 'portraits-grants/' || g.id || '.jpg');

  -- Never delivered: issued, or claimed by a render that has been dead longer
  -- than any render can live.
  with r as (
    update generation_grants g
       set status = 'refunded', refunded_at = now(), claim_token = null
     where g.owner_key = p_owner and g.ref_id = p_ref
       and (g.status = 'issued' or (g.status = 'claimed' and g.claimed_at < v_stale))
    returning g.cost_credits
  )
  select count(*)::integer, coalesce(sum(cost_credits), 0)::integer, array_agg(cost_credits)
    into v_units, v_credits, v_costs
    from r;

  if v_credits > 0 then
    insert into credit_balances (owner_key, balance) values (p_owner, v_credits)
    on conflict (owner_key) do update
      set balance = credit_balances.balance + v_credits, updated_at = now()
    returning balance into v_bal;

    -- One ledger row per unit refunded BY THIS CALL (taken from the update
    -- itself, never re-selected), with a running balance, matching how the
    -- gate writes its spend rows.
    v_running := v_bal - v_credits;
    foreach v_cost in array v_costs loop
      if v_cost > 0 then
        v_running := v_running + v_cost;
        insert into credit_ledger (owner_key, delta, reason, ref_id, balance_after)
        values (p_owner, v_cost, 'refund', p_ref, v_running);
      end if;
    end loop;
  else
    select b.balance into v_bal from credit_balances b where b.owner_key = p_owner;
  end if;

  refunded_units   := v_units;
  refunded_credits := v_credits;
  select count(*)::integer into already_refunded from generation_grants g
   where g.owner_key = p_owner and g.ref_id = p_ref and g.status = 'refunded';
  already_refunded := already_refunded - v_units;
  select count(*)::integer into delivered_units from generation_grants g
   where g.owner_key = p_owner and g.ref_id = p_ref and g.status = 'consumed';
  select count(*)::integer into held_units from generation_grants g
   where g.owner_key = p_owner and g.ref_id = p_ref and g.status = 'claimed';
  balance_after := coalesce(v_bal, 0);
  return next;
end;
$$;

-- ── nobody but the server moves credits ─────────────────────────────────
revoke execute on function issue_generation_grants(text, text, text[], integer, boolean) from public, anon, authenticated;
revoke execute on function refund_generation_grants(text, text, integer)                from public, anon, authenticated;
grant  execute on function issue_generation_grants(text, text, text[], integer, boolean) to service_role;
grant  execute on function refund_generation_grants(text, text, integer)                to service_role;

revoke execute on function grant_credits(text, integer, text, text) from public, anon, authenticated;
revoke execute on function refund_credits(text, integer)            from public, anon, authenticated;
revoke execute on function spend_credits(text, integer)             from public, anon, authenticated;
revoke execute on function spend_credits_sweep(text, integer)       from public, anon, authenticated;
revoke execute on function redeem_code(text, text)                  from public, anon, authenticated;
grant  execute on function grant_credits(text, integer, text, text) to service_role;
grant  execute on function refund_credits(text, integer)            to service_role;
grant  execute on function spend_credits(text, integer)             to service_role;
grant  execute on function spend_credits_sweep(text, integer)       to service_role;
grant  execute on function redeem_code(text, text)                  to service_role;
