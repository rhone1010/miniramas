-- supabase/migrations/020_community_reward.sql
--
-- TEN POSTS EARNS ONE FREE CRAFT.
--
-- 018 created the tables. This is the money part, and it lives in the
-- database rather than in a route on purpose: granting a credit means three
-- writes that must all happen or none of them (the reward row, the ledger
-- row, the balance), and a route that does three writes in sequence will one
-- day do two of them and hand somebody a credit with no ledger entry behind
-- it.
--
-- 019 is left free for the support_messages migration currently sitting
-- untracked - it was written as 016, which is already error_log.
--
-- WHY POSTING EARNS AND HEARTING DOES NOT
--   Hearting is free to the person doing it, so anything it buys is a thing
--   to manufacture. A post requires a craft and a craft costs credits: ten
--   posts is roughly a hundred credits already spent. The gate is economic,
--   so there is nothing to game - the only route to ten is to buy ten.

begin;

-- ---------------------------------------------------------------------------
-- THE AWARD
--
-- Returns the number of credits granted by this call, which is 0 almost every
-- time. Safe to call after every post: the primary key on community_rewards
-- is what stops a threshold being paid twice, not the caller remembering.
--
-- Counts DISTINCT PIECES that are still LIVE. Withdrawing and re-posting
-- earns nothing, and a held or removed post earns nothing - otherwise the
-- cheapest path to a free craft is ten posts nobody was meant to see.
-- ---------------------------------------------------------------------------
create or replace function community_award_posts(p_owner text)
returns integer
language plpgsql
security definer
as $$
declare
  v_live      integer;
  v_threshold integer;
  v_award     integer := 10;   -- one craft, at CREDITS_PER_IMAGE
  v_balance   integer;
begin
  if p_owner is null or p_owner = '' then
    return 0;
  end if;

  select count(distinct piece_id)
    into v_live
    from community_posts
   where owner_key = p_owner
     and state = 'live';

  v_threshold := (v_live / 10) * 10;      -- integer division: 9 -> 0, 23 -> 20
  if v_threshold < 10 then
    return 0;
  end if;

  -- The claim. If this row already exists the threshold has been paid and we
  -- stop here without touching the ledger. Doing it first means a failure
  -- anywhere below rolls the claim back with it.
  begin
    insert into community_rewards (owner_key, threshold)
    values (p_owner, v_threshold);
  exception when unique_violation then
    return 0;
  end;

  -- Balance first, so the ledger's balance_after is true at the moment it is
  -- written rather than a number computed beside it.
  insert into credit_balances (owner_key, balance, updated_at)
  values (p_owner, v_award, now())
  on conflict (owner_key) do update
    set balance    = credit_balances.balance + v_award,
        updated_at = now()
  returning balance into v_balance;

  insert into credit_ledger (owner_key, delta, reason, ref_id, balance_after)
  values (
    p_owner,
    v_award,
    'community_ten',
    'threshold:' || v_threshold::text,
    v_balance
  );

  return v_award;
end $$;

comment on function community_award_posts(text) is
  'Grants one craft per ten live posted pieces. Idempotent per threshold. Returns credits granted.';

-- The service role is the only caller; routes reach Supabase with it and no
-- browser ever touches this.
revoke all on function community_award_posts(text) from public, anon, authenticated;

commit;
