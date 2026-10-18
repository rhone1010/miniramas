-- 050_gift_previews_before_purchase.sql
--
-- Gift Wizard: PREVIEWS BEFORE PURCHASE. NOT APPLIED. Requires 047, 048 and 049.
--
-- The customer sees their personalized artwork before buying a physical product:
--   * the first six previews are FREE and the second six are FREE, with no product purchase required;
--   * every further six costs $2.99 (a verified pack, consumed exactly as before);
--   * a product purchase no longer grants previews (it only unlocks compositions of the favorite the customer already chose).
--
-- Free batches are SERVER-CONTROLLED and cannot be repeated by recreating a session. Every free batch is recorded in gift_free_grants, a ledger
-- that is NOT deleted with the session (its session and batch links are set null), and the caps below are enforced inside the reservation, under
-- the session lock:
--     per session            2 free batches
--     per account + photo    2 free batches in total, across every session (and deleted session) made from the same photograph
--     per account, 24 hours  6 free batches
--     per account, lifetime  20 free batches
-- The numbers are parameters of the functions (defaults below) so policy changes need no migration.
--
-- WHAT THIS CHANGES
--   gift_reserve_batch   redefined: no paid order is needed. A free batch if the caps allow, else a paid pack, else payment_required. While an order
--                        exists, generation is allowed until the order is approved (awaiting_artwork, or unpaid 'created'); after approval it is refused.
--   gift_select_artwork  redefined: the favorite can be chosen and saved before any order exists (and while an unpaid or awaiting order exists). Changing it
--                        before approval still supersedes the compositions of the old artwork.
--   gift_free_status     new, read-only: whether a free batch is available and why not. gift_reserve_batch uses the same function, so the rule has one home.
--   gift_free_grants     new ledger table (service role only).
-- NOT changed: gift_confirm_order (payment confirmation, idempotency, pinning), packs, compositions, corrections, approval, refunds.
-- The old 5-argument gift_reserve_batch is DROPPED and replaced by the 9-argument one (same name, same result columns): this is the only
-- non-additive step, and it is reversible by re-running 048's definition.

create table if not exists public.gift_free_grants (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  source_sha256  text not null,
  session_id     uuid references public.gift_sessions(id) on delete set null,
  batch_id       uuid references public.gift_batches(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists gift_free_grants_user_idx  on public.gift_free_grants(user_id, created_at);
create index if not exists gift_free_grants_photo_idx on public.gift_free_grants(user_id, source_sha256);
alter table public.gift_free_grants enable row level security;

-- Whether this session may take another FREE batch, and if not, why. Read-only.
create or replace function public.gift_free_status(p_session uuid, p_user uuid, p_session_cap int default 2, p_photo_cap int default 2, p_24h_cap int default 6, p_total_cap int default 20)
returns table (o_available boolean, o_used_in_session int, o_reason text)
language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; used int;
begin
  select * into s from public.gift_sessions where id = p_session;
  if not found or s.user_id <> p_user then raise exception 'session_not_found'; end if;
  select count(*) into used from public.gift_batches where session_id = p_session and kind = 'free';
  if used >= p_session_cap then return query select false, used, 'session_limit'::text; return; end if;
  if (select count(*) from public.gift_free_grants where user_id = p_user and source_sha256 = s.source_sha256) >= p_photo_cap then
    return query select false, used, 'photo_limit'::text; return;
  end if;
  if (select count(*) from public.gift_free_grants where user_id = p_user and created_at > now() - interval '24 hours') >= p_24h_cap then
    return query select false, used, 'daily_limit'::text; return;
  end if;
  if (select count(*) from public.gift_free_grants where user_id = p_user) >= p_total_cap then
    return query select false, used, 'lifetime_limit'::text; return;
  end if;
  return query select true, used, null::text;
end $$;

drop function if exists public.gift_reserve_batch(uuid, uuid, text, text[], int);
create or replace function public.gift_reserve_batch(p_session uuid, p_user uuid, p_key text, p_effects text[], p_session_cap int default 2, p_photo_cap int default 2, p_24h_cap int default 6, p_total_cap int default 20)
returns table (o_batch_id uuid, o_batch_index int, o_kind text, o_reused boolean)
language plpgsql security definer set search_path = public as $$
declare
  s public.gift_sessions; o record; existing public.gift_batches; fs record;
  n int; v_kind text; v_pack uuid; v_batch uuid; i int;
begin
  select * into s from public.gift_sessions where id = p_session for update;
  if not found or s.user_id <> p_user then raise exception 'session_not_found'; end if;
  if s.status <> 'active' or (s.expires_at < now() and s.pinned_at is null) then raise exception 'session_expired'; end if;

  select * into existing from public.gift_batches where session_id = p_session and idempotency_key = p_key;
  if found then
    return query select existing.id, existing.batch_index, existing.kind, true;
    return;
  end if;

  if s.refunded_at is not null then raise exception 'order_refunded'; end if;
  if s.refund_requested_at is not null then raise exception 'refund_pending'; end if;
  -- Generation needs no order. If one exists it must not be past approval: created (unpaid) and awaiting_artwork are fine.
  if s.order_id is not null then
    select status::text as status into o from public.print_orders where id = s.order_id;
    if found and o.status not in ('created', 'awaiting_artwork', 'cancelled') then raise exception 'order_not_awaiting_artwork'; end if;
  end if;

  if p_effects is null or cardinality(p_effects) <> 6 or (select count(distinct e) from unnest(p_effects) e) <> 6 then
    raise exception 'six_distinct_effects_required';
  end if;
  if exists (select 1 from public.gift_previews gp where gp.session_id = p_session and gp.effect_id = any (p_effects)) then
    raise exception 'effect_already_used';
  end if;
  if exists (select 1 from public.gift_previews gp where gp.session_id = p_session and gp.status <> 'ready') then
    raise exception 'previous_batch_incomplete';
  end if;

  select count(*) into n from public.gift_batches where session_id = p_session;
  select * into fs from public.gift_free_status(p_session, p_user, p_session_cap, p_photo_cap, p_24h_cap, p_total_cap);
  if fs.o_available then
    v_kind := 'free';
  else
    select id into v_pack from public.gift_preview_packs
      where user_id = p_user and status = 'paid' order by paid_at, id limit 1 for update skip locked;
    if v_pack is null then raise exception 'payment_required'; end if;
    v_kind := 'paid';
  end if;

  insert into public.gift_batches(session_id, user_id, batch_index, kind, pack_id, idempotency_key, effect_ids)
    values (p_session, p_user, n + 1, v_kind, v_pack, p_key, p_effects) returning id into v_batch;
  for i in 1..6 loop
    insert into public.gift_previews(batch_id, session_id, slot, effect_id) values (v_batch, p_session, i, p_effects[i]);
  end loop;
  if v_pack is not null then
    update public.gift_preview_packs set status = 'consumed', consumed_at = now(), consumed_batch_id = v_batch where id = v_pack;
  end if;
  if v_kind = 'free' then
    insert into public.gift_free_grants(user_id, source_sha256, session_id, batch_id) values (p_user, s.source_sha256, p_session, v_batch);
  end if;
  update public.gift_sessions set last_activity_at = now(),
    expires_at = least(created_at + interval '30 days', greatest(expires_at, now() + interval '7 days')) where id = p_session and pinned_at is null;
  update public.gift_sessions set last_activity_at = now() where id = p_session and pinned_at is not null;
  return query select v_batch, n + 1, v_kind, false;
end $$;

-- Choose and SAVE the favorite: before any order, while an unpaid order is open, or while a paid order awaits its artwork. Changing it before approval
-- supersedes the compositions of the artwork it replaces (there are none before payment).
create or replace function public.gift_select_artwork(p_session uuid, p_user uuid, p_preview uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; ost text;
begin
  select * into s from public.gift_sessions where id = p_session for update;
  if not found or s.user_id <> p_user then raise exception 'session_not_found'; end if;
  if s.order_id is not null then
    select status::text into ost from public.print_orders where id = s.order_id;
    if ost is not null and ost not in ('created', 'awaiting_artwork', 'cancelled') then raise exception 'order_not_awaiting_artwork'; end if;
  end if;
  if s.refunded_at is not null then raise exception 'order_refunded'; end if;
  if s.refund_requested_at is not null then raise exception 'refund_pending'; end if;
  if s.status <> 'active' or (s.expires_at < now() and s.pinned_at is null) then raise exception 'session_expired'; end if;
  if not exists (select 1 from public.gift_previews gp where gp.id = p_preview and gp.session_id = p_session and gp.status = 'ready') then
    raise exception 'preview_not_ready';
  end if;
  update public.gift_compositions set status = 'superseded' where session_id = p_session and preview_id <> p_preview and status in ('ready', 'approved');
  update public.gift_sessions set artwork_preview_id = p_preview, last_activity_at = now() where id = p_session;
end $$;

-- Only the service role may call these (the same explicit revokes and grants as 047 and 048).
revoke all on function public.gift_free_status(uuid, uuid, int, int, int, int)                              from public, anon, authenticated;
revoke all on function public.gift_reserve_batch(uuid, uuid, text, text[], int, int, int, int)              from public, anon, authenticated;
revoke all on function public.gift_select_artwork(uuid, uuid, uuid)                                         from public, anon, authenticated;
revoke all on public.gift_free_grants from anon, authenticated;
grant execute on function public.gift_free_status(uuid, uuid, int, int, int, int)                           to service_role;
grant execute on function public.gift_reserve_batch(uuid, uuid, text, text[], int, int, int, int)           to service_role;
grant execute on function public.gift_select_artwork(uuid, uuid, uuid)                                      to service_role;
grant select, insert, update, delete on public.gift_free_grants to service_role;
