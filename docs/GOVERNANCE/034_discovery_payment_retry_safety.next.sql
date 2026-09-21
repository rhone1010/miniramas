-- Service-only checkout reservation and atomic included-unlock activation.
-- LOCAL REVIEW REVISION, 2026-09-21. Not applied.
-- No catalog, pricing, reusable-credit or Unlock All changes.
-- Adds a narrowly scoped trigger on existing entitlements so the legacy
-- Production insert path and the new activation RPC share the same lock.
-- This is no longer an entirely inert/additive installation: legacy included
-- entitlement inserts are guarded as soon as this transaction commits.
begin;

create table public.discovery_unlock_checkouts (
  preview_id uuid primary key references public.preview_ledger(id),
  -- Reservation state follows the existing entitlement account-deletion rule.
  -- Financial purchase records are not cascaded by this relationship.
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  params jsonb not null,
  amount_cents integer not null check (amount_cents > 0),
  session_id text unique,
  purchase_id uuid references public.purchases(id)
);
alter table public.discovery_unlock_checkouts enable row level security;
revoke all on public.discovery_unlock_checkouts from public, anon, authenticated;
grant all on public.discovery_unlock_checkouts to service_role;

create function public.reserve_discovery_unlock(
  p_preview uuid, p_user uuid, p_params jsonb, p_amount integer,
  p_expired_attempt uuid default null
) returns public.discovery_unlock_checkouts
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.discovery_unlock_checkouts; l public.preview_ledger;
begin
  -- The existing ledger row serializes reservations across all server instances.
  select * into strict l from public.preview_ledger where id = p_preview for update;
  if l.unlocked_at is not null then raise exception 'unlock_already_unlocked'; end if;
  if not exists (
    select 1 from public.portfolio_items i join public.portfolios p on p.id = i.portfolio_id
    where i.preview_id::text = p_preview::text and i.status = 'done' and p.user_id = p_user
  ) then raise exception 'unlock_wrong_owner'; end if;
  select * into r from public.discovery_unlock_checkouts where preview_id = p_preview;
  if found then
    if r.user_id <> p_user then raise exception 'unlock_wrong_owner'; end if;
    -- Rotation is only requested after the server has retrieved an expired
    -- Stripe session. A stale concurrent caller cannot rotate a newer attempt.
    if p_expired_attempt is not null and r.attempt_id = p_expired_attempt then
      if r.session_id is null then raise exception 'unlock_session_unknown'; end if;
      update public.discovery_unlock_checkouts set attempt_id = gen_random_uuid(),
        created_at = now(), params = p_params, amount_cents = p_amount,
        session_id = null, purchase_id = null where preview_id = p_preview returning * into r;
    end if;
    return r;
  end if;
  insert into public.discovery_unlock_checkouts(preview_id,user_id,params,amount_cents)
    values(p_preview,p_user,p_params,p_amount) returning * into r;
  return r;
end $$;

create function public.complete_discovery_unlock_checkout(
  p_preview uuid, p_user uuid, p_attempt uuid, p_session text
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.discovery_unlock_checkouts; purchase uuid;
begin
  select * into strict r from public.discovery_unlock_checkouts where preview_id = p_preview for update;
  if r.user_id <> p_user or r.attempt_id <> p_attempt then raise exception 'unlock_stale_attempt'; end if;
  if r.session_id is not null and r.session_id <> p_session then raise exception 'unlock_session_mismatch'; end if;
  if r.purchase_id is not null then return r.purchase_id; end if;
  insert into public.purchases(user_id,sku_id,stripe_session_id,amount_cents,status)
    values(p_user,'unlock_addon_1',p_session,r.amount_cents,'pending') returning id into purchase;
  insert into public.entitlements(purchase_id,user_id,locked_style,locked_variant,status)
    values(purchase,p_user,'discovery_unlock',p_preview::text,'pending');
  update public.discovery_unlock_checkouts set session_id = p_session, purchase_id = purchase
    where preview_id = p_preview;
  return purchase;
end $$;

-- Legacy activatePortfolio inserts unbound available entitlements directly,
-- then updates portfolio status in a later request. Locking only in the new
-- RPC cannot protect against that writer. Both paths must acquire the same
-- portfolio row lock BEFORE any included entitlement is inserted.
create function public.guard_discovery_included_unlock_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.portfolios; existing_count integer;
begin
  -- Only the included-unlock insertion shape used by Production activation.
  -- Bound paid unlocks and unrelated commerce retain their existing behavior.
  if new.status is distinct from 'available'
     or new.locked_style is not null or new.locked_variant is not null then
    return new;
  end if;
  begin
    select * into strict p from public.portfolios
      where purchase_id = new.purchase_id for update;
  exception when no_data_found then
    return new;
  end;
  if p.free_unlocks is null or p.free_unlocks < 0 then
    raise exception 'portfolio_invalid_unlock_allowance';
  end if;
  if new.user_id is distinct from p.user_id or new.guest_email is not null then
    raise exception 'portfolio_entitlement_owner_mismatch';
  end if;
  if not exists(select 1 from public.purchases where id = new.purchase_id and status = 'paid') then
    raise exception 'portfolio_purchase_not_paid';
  end if;
  -- Count consumed unlocks too: spending an included unlock must not replenish it.
  select count(*) into existing_count from public.entitlements
    where purchase_id = new.purchase_id;
  if existing_count > p.free_unlocks then
    raise exception 'portfolio_entitlement_count_mismatch';
  end if;
  if existing_count = p.free_unlocks then
    -- A stale legacy activation still receives a successful INSERT response.
    -- It does not inspect returned rows. Suppress only the excess insertion.
    return null;
  end if;
  return new;
end $$;

create trigger discovery_included_unlock_insert_guard
before insert on public.entitlements
for each row execute function public.guard_discovery_included_unlock_insert();

create function public.activate_discovery_portfolio(p_purchase uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.portfolios; existing_count integer;
begin
  select * into p from public.portfolios where purchase_id = p_purchase for update;
  if not found then return; end if;
  if not exists(select 1 from public.purchases where id = p_purchase and status = 'paid') then
    raise exception 'portfolio_purchase_not_paid';
  end if;
  if p.status <> 'pending' then return; end if;
  -- Count existing included entitlements as well, to recover a partial legacy
  -- activation without granting them twice. Paid single-piece unlocks have
  -- their own purchase and are not included in this count.
  select count(*) into existing_count from public.entitlements where purchase_id = p_purchase;
  if existing_count > p.free_unlocks then raise exception 'portfolio_entitlement_count_mismatch'; end if;
  insert into public.entitlements(purchase_id,user_id,guest_email,locked_style,locked_variant,status)
    select p_purchase,p.user_id,null,null,null,'available'
    from generate_series(existing_count + 1,p.free_unlocks);
  update public.portfolios set status = 'generating' where id = p.id;
end $$;

-- Trigger execution is automatic; no public RPC execution permission needed.
revoke all on function public.guard_discovery_included_unlock_insert() from public, anon, authenticated;
revoke all on function public.reserve_discovery_unlock(uuid,uuid,jsonb,integer,uuid) from public, anon, authenticated;
revoke all on function public.complete_discovery_unlock_checkout(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.activate_discovery_portfolio(uuid) from public, anon, authenticated;
grant execute on function public.reserve_discovery_unlock(uuid,uuid,jsonb,integer,uuid) to service_role;
grant execute on function public.complete_discovery_unlock_checkout(uuid,uuid,uuid,text) to service_role;
grant execute on function public.activate_discovery_portfolio(uuid) to service_role;
commit;
