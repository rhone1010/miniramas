-- 048_gift_orders.sql
--
-- Gift Wizard: purchase BEFORE generation. Order state, payment confirmation, batch entitlements tied to a paid order,
-- product compositions and their approval, the one-time digital unlock into My Collection, and refund handling.
--
-- NOT APPLIED. Requires 046 (print_asset_jobs) and 047 (gift_*). Review, then run in the Supabase SQL editor, and run
-- gift-048-preflight-and-verify.sql around it. Additive: existing orders, jobs and portfolios behave as before.
--
-- THE FLOW THESE FUNCTIONS ENFORCE
--   checkout        a print_orders row in 'created' linked 1:1 to a gift session (the API creates it with the Stripe session)
--   payment         gift_confirm_order (called only after the API verified the session with Stripe): 'created' ->
--                   'awaiting_artwork', two free batches granted, session pinned (retained until resolved)
--   generation      gift_reserve_batch refuses until the linked order is paid; the 2 free batches come from the order
--   approval        gift_approve_order: every order line has an approved composition of the ONE selected artwork; the
--                   artwork becomes an UNLOCKED My Collection piece (no entitlement, no credit consumed); the order moves
--                   'awaiting_artwork' -> 'paid', which is the only thing the existing fulfilment pipeline looks for
--   refund          gift_request_refund (Concierge), gift_apply_refund (only after the API verified the refund with Stripe)
-- 'awaiting_artwork' is invisible to the poller, completePrintOrder, retry and admin paths (they look for paid/withheld/error),
-- so nothing can reach Prodigi before approval.

alter type public.print_order_status add value if not exists 'awaiting_artwork';

-- Print jobs gain a source that reads the customer's APPROVED composition from the Gift Wizard.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.print_asset_jobs'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%source_kind%';
  if c is not null then execute format('alter table public.print_asset_jobs drop constraint %I', c); end if;
  alter table public.print_asset_jobs add constraint print_asset_jobs_source_kind_check check (source_kind in ('owned', 'url', 'gift'));
end $$;

-- My Collection accepts a Gift Wizard piece the way it accepts an adopted Foyer piece: no purchase row, no payment fabricated.
alter table public.portfolios drop constraint if exists portfolios_origin_purchase_check;
alter table public.portfolios add constraint portfolios_origin_purchase_check check (
  (origin = 'discovery' and purchase_id is not null) or
  (origin = 'foyer' and purchase_id is null and series in ('portraits', 'pets') and size = 1 and delivery = 'preview' and free_unlocks = 0) or
  (origin = 'gift'  and purchase_id is null and series in ('portraits', 'pets', 'groups') and size = 1 and delivery = 'preview' and free_unlocks = 0)
);

alter table public.gift_sessions
  add column if not exists order_id               uuid unique references public.print_orders(id),
  add column if not exists free_batches_granted   int  not null default 0 check (free_batches_granted between 0 and 10),
  add column if not exists artwork_preview_id     uuid,
  add column if not exists approved_at            timestamptz,
  add column if not exists refund_requested_at    timestamptz,
  add column if not exists refunded_at            timestamptz,
  add column if not exists unlock_portfolio_id    uuid,
  add column if not exists disclosure_version     text,
  add column if not exists disclosure_accepted_at timestamptz;

-- The purchased lines, frozen at payment. line_index is the print_orders.items index.
create table if not exists public.gift_order_lines (
  order_id         uuid not null references public.print_orders(id),
  line_index       int  not null check (line_index >= 0),
  session_id       uuid not null references public.gift_sessions(id) on delete cascade,
  line_id          text not null,
  product_id       text not null,
  sku              text not null,
  copies           int  not null check (copies between 1 and 20),
  corrections_used int  not null default 0 check (corrections_used between 0 and 1),
  primary key (order_id, line_index),
  unique (session_id, line_id)
);

-- One composition per (line, artwork, attempt). attempt 1 is the first; attempt 2 is the ONE free correction.
create table if not exists public.gift_compositions (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.gift_sessions(id) on delete cascade,
  line_id       text not null,
  preview_id    uuid not null,
  attempt       int  not null check (attempt in (1, 2)),
  status        text not null default 'ready' check (status in ('ready', 'approved', 'failed', 'superseded')),
  composed_path text,
  preview_path  text,
  width         int,
  height        int,
  plan          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  approved_at   timestamptz,
  unique (session_id, line_id, preview_id, attempt),
  check (status not in ('ready', 'approved') or (composed_path is not null and preview_path is not null))
);
create index if not exists gift_compositions_session_idx on public.gift_compositions(session_id, line_id);

create table if not exists public.gift_refund_requests (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null unique references public.print_orders(id),
  session_id          uuid not null references public.gift_sessions(id) on delete cascade,
  user_id             uuid not null,
  status              text not null default 'requested' check (status in ('requested', 'refunded', 'declined')),
  reason              text,
  concierge_message   uuid,
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);

-- Every verified refund, once. The Stripe refund id is the idempotency key.
create table if not exists public.gift_refunds (
  refund_id     text primary key,
  order_id      uuid not null references public.print_orders(id),
  amount_cents  int  not null check (amount_cents > 0),
  created_at    timestamptz not null default now()
);

alter table public.gift_order_lines      enable row level security;
alter table public.gift_compositions     enable row level security;
alter table public.gift_refund_requests  enable row level security;
alter table public.gift_refunds          enable row level security;

-- Link a gift session to its (unpaid) order. One order per session, one session per order.
create or replace function public.gift_link_order(p_session uuid, p_user uuid, p_order uuid, p_version text)
returns void language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions;
begin
  select * into s from public.gift_sessions where id = p_session for update;
  if not found or s.user_id <> p_user then raise exception 'session_not_found'; end if;
  if s.order_id is not null and s.order_id <> p_order then raise exception 'session_already_has_order'; end if;
  update public.gift_sessions set order_id = p_order, disclosure_version = p_version,
         disclosure_accepted_at = coalesce(disclosure_accepted_at, now()), last_activity_at = now() where id = p_session;
end $$;

-- Payment verified by the API (retrieved from Stripe, amounts and lines checked). Idempotent.
create or replace function public.gift_confirm_order(p_session uuid, p_order uuid, p_user uuid, p_stripe_session text, p_intent text, p_lines jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; o record;
begin
  select * into s from public.gift_sessions where id = p_session for update;
  if not found or s.user_id <> p_user or s.order_id is distinct from p_order then raise exception 'session_not_found'; end if;
  select status, stripe_session_id into o from public.print_orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.stripe_session_id <> p_stripe_session then raise exception 'order_session_mismatch'; end if;
  if o.status = 'created' then
    update public.print_orders set status = 'awaiting_artwork', stripe_payment_intent = p_intent, paid_at = now(), updated_at = now() where id = p_order;
    update public.gift_sessions set free_batches_granted = 2, pinned_at = coalesce(pinned_at, now()), last_activity_at = now() where id = p_session;
    insert into public.gift_order_lines(order_id, line_index, session_id, line_id, product_id, sku, copies)
      select p_order, (e.ord - 1)::int, p_session, e.v ->> 'lineId', e.v ->> 'productId', e.v ->> 'sku', (e.v ->> 'copies')::int
        from jsonb_array_elements(p_lines) with ordinality as e(v, ord)
      on conflict do nothing;
    return 'confirmed';
  elsif o.status::text = 'cancelled' then
    raise exception 'order_not_payable';
  end if;
  return 'already';
end $$;

-- Redefines 047's reservation: generation requires a PAID, unrefunded order; the free batches come from the order.
create or replace function public.gift_reserve_batch(p_session uuid, p_user uuid, p_key text, p_effects text[], p_free int default 2)
returns table (o_batch_id uuid, o_batch_index int, o_kind text, o_reused boolean)
language plpgsql security definer set search_path = public as $$
declare
  s public.gift_sessions; o record; existing public.gift_batches;
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
  if s.order_id is null then raise exception 'order_payment_required'; end if;
  select status, paid_at into o from public.print_orders where id = s.order_id;
  if not found or o.paid_at is null or o.status::text in ('created', 'cancelled') then raise exception 'order_payment_required'; end if;

  if p_effects is null or cardinality(p_effects) <> 6 or (select count(distinct e) from unnest(p_effects) e) <> 6 then
    raise exception 'six_distinct_effects_required';
  end if;
  if exists (select 1 from public.gift_previews gp where gp.session_id = p_session and gp.effect_id = any (p_effects)) then
    raise exception 'effect_already_used';
  end if;
  if exists (select 1 from public.gift_previews gp where gp.session_id = p_session and gp.status <> 'ready') then
    raise exception 'previous_batch_incomplete';
  end if;
  if o.status::text <> 'awaiting_artwork' then raise exception 'order_not_awaiting_artwork'; end if;

  select count(*) into n from public.gift_batches where session_id = p_session;
  if n < s.free_batches_granted then
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
  update public.gift_sessions set last_activity_at = now(),
    expires_at = least(created_at + interval '30 days', greatest(expires_at, now() + interval '7 days')) where id = p_session and pinned_at is null;
  update public.gift_sessions set last_activity_at = now() where id = p_session and pinned_at is not null;
  return query select v_batch, n + 1, v_kind, false;
end $$;

-- Choose THE artwork (one per order). Switching is allowed until approval and supersedes the old compositions.
create or replace function public.gift_select_artwork(p_session uuid, p_user uuid, p_preview uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; ost text;
begin
  select * into s from public.gift_sessions where id = p_session for update;
  if not found or s.user_id <> p_user then raise exception 'session_not_found'; end if;
  if s.order_id is null then raise exception 'order_payment_required'; end if;
  select status::text into ost from public.print_orders where id = s.order_id;
  if ost <> 'awaiting_artwork' then raise exception 'order_not_awaiting_artwork'; end if;
  if s.refunded_at is not null then raise exception 'order_refunded'; end if;
  if s.refund_requested_at is not null then raise exception 'refund_pending'; end if;
  if not exists (select 1 from public.gift_previews gp where gp.id = p_preview and gp.session_id = p_session and gp.status = 'ready') then
    raise exception 'preview_not_ready';
  end if;
  update public.gift_compositions set status = 'superseded' where session_id = p_session and preview_id <> p_preview and status in ('ready', 'approved');
  update public.gift_sessions set artwork_preview_id = p_preview, last_activity_at = now() where id = p_session;
end $$;

-- Spend the order line's ONE free correction. Raises correction_limit when it is gone (the rest goes to Concierge).
create or replace function public.gift_use_correction(p_session uuid, p_user uuid, p_line text)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from public.gift_sessions where id = p_session and user_id = p_user) then raise exception 'session_not_found'; end if;
  update public.gift_order_lines set corrections_used = corrections_used + 1
    where session_id = p_session and line_id = p_line and corrections_used < 1;
  get diagnostics n = row_count;
  if n = 0 then
    if exists (select 1 from public.gift_order_lines where session_id = p_session and line_id = p_line) then raise exception 'correction_limit'; end if;
    raise exception 'line_not_found';
  end if;
end $$;

-- Approve the order: every line approved for the selected artwork; the artwork becomes an unlocked My Collection piece
-- (the way an adopted Foyer piece does, but born unlocked, with no entitlement and no credit); then 'awaiting_artwork' -> 'paid'.
create or replace function public.gift_approve_order(p_session uuid, p_user uuid, p_portfolio uuid, p_clean_path text, p_source_image text)
returns text language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; ost text; pv record; identity_key text;
begin
  select * into s from public.gift_sessions where id = p_session for update;
  if not found or s.user_id <> p_user then raise exception 'session_not_found'; end if;
  if s.order_id is null then raise exception 'order_payment_required'; end if;
  if s.refunded_at is not null then raise exception 'order_refunded'; end if;
  if s.refund_requested_at is not null then raise exception 'refund_pending'; end if;
  select status::text into ost from public.print_orders where id = s.order_id for update;
  if ost <> 'awaiting_artwork' then
    if s.approved_at is not null then return 'already'; end if;
    raise exception 'order_not_awaiting_artwork';
  end if;
  if s.artwork_preview_id is null then raise exception 'artwork_not_selected'; end if;
  if not exists (select 1 from public.gift_order_lines where order_id = s.order_id) then raise exception 'order_has_no_lines'; end if;
  if exists (select 1 from public.gift_order_lines l where l.order_id = s.order_id and not exists (
       select 1 from public.gift_compositions c where c.session_id = s.id and c.line_id = l.line_id
          and c.preview_id = s.artwork_preview_id and c.status = 'approved')) then
    raise exception 'compositions_not_approved';
  end if;

  if s.unlock_portfolio_id is null then
    select g.effect_id into pv from public.gift_previews g where g.id = s.artwork_preview_id and g.session_id = s.id and g.status = 'ready';
    if not found then raise exception 'preview_not_ready'; end if;
    insert into public.portfolios(id, purchase_id, user_id, series, size, status, free_unlocks, source_image, composition, delivery, pose, framing, subject, aspect_ratio, origin)
      values (p_portfolio, null, p_user, s.series, 1, 'ready', 0, p_source_image,
              jsonb_build_object('gift', jsonb_build_object('session', s.id, 'order', s.order_id), 'skip_redirect', true),
              'preview', 'as_photographed', 'bust', null, s.master_aspect, 'gift');
    identity_key := 'portfolio:' || p_portfolio::text || ':0';
    insert into public.preview_ledger(id, email, ip_hash, series, preset, resolution, storage_path, unlocked_at)
      values (s.artwork_preview_id, identity_key, identity_key, s.series, pv.effect_id, '1k', p_clean_path, now());
    insert into public.portfolio_items(portfolio_id, slot, preset, status, preview_id) values (p_portfolio, 0, pv.effect_id, 'done', s.artwork_preview_id);
    update public.gift_sessions set unlock_portfolio_id = p_portfolio where id = s.id;
  end if;

  update public.print_orders set status = 'paid', updated_at = now() where id = s.order_id and status::text = 'awaiting_artwork';
  update public.gift_sessions set approved_at = now(), last_activity_at = now() where id = s.id;
  return 'approved';
end $$;

-- Customer asks Concierge for a full refund. Idempotent per order. Manufacturing is never started by this.
create or replace function public.gift_request_refund(p_session uuid, p_user uuid, p_reason text, p_message uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; o record; r public.gift_refund_requests;
begin
  select * into s from public.gift_sessions where id = p_session for update;
  if not found or s.user_id <> p_user then raise exception 'session_not_found'; end if;
  if s.order_id is null then raise exception 'order_not_paid'; end if;
  select status::text as status, paid_at, prodigi_order_id, placed_at into o from public.print_orders where id = s.order_id;
  if o.paid_at is null or o.status = 'created' then raise exception 'order_not_paid'; end if;
  if o.status = 'cancelled' or s.refunded_at is not null then raise exception 'order_refunded'; end if;
  if o.prodigi_order_id is not null or o.placed_at is not null or o.status in ('placed', 'in_production', 'shipped', 'delivered') then
    raise exception 'refund_not_available_after_manufacturing';
  end if;
  select * into r from public.gift_refund_requests where order_id = s.order_id;
  if found then
    if r.status = 'requested' then return r.id; end if;
    update public.gift_refund_requests set status = 'requested', resolved_at = null, reason = p_reason where id = r.id;
  else
    insert into public.gift_refund_requests(order_id, session_id, user_id, reason, concierge_message) values (s.order_id, s.id, p_user, p_reason, p_message) returning * into r;
  end if;
  update public.gift_sessions set refund_requested_at = now(), last_activity_at = now() where id = s.id;
  return r.id;
end $$;

-- Concierge declines: the request is closed and the customer can continue. (Service role only.)
create or replace function public.gift_decline_refund(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.gift_refund_requests set status = 'declined', resolved_at = now() where order_id = p_order and status = 'requested';
  update public.gift_sessions set refund_requested_at = null where order_id = p_order and refunded_at is null;
end $$;

-- A refund the API VERIFIED with Stripe. Idempotent on the Stripe refund id. A full refund of an order that has not
-- been placed with the lab cancels it and releases the session for cleanup; nothing is manufactured.
create or replace function public.gift_apply_refund(p_order uuid, p_refund_id text, p_amount int, p_full boolean)
returns text language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; o record; ins int;
begin
  select * into s from public.gift_sessions where order_id = p_order for update;
  if not found then return 'not_gift_order'; end if;
  insert into public.gift_refunds(refund_id, order_id, amount_cents) values (p_refund_id, p_order, p_amount) on conflict (refund_id) do nothing;
  get diagnostics ins = row_count;
  if ins = 0 then return 'already'; end if;
  if not p_full then return 'recorded_partial'; end if;
  select status::text as status, prodigi_order_id into o from public.print_orders where id = p_order for update;
  update public.gift_sessions set refunded_at = now(), refund_requested_at = null where id = s.id;
  update public.gift_refund_requests set status = 'refunded', resolved_at = now() where order_id = p_order;
  if o.prodigi_order_id is not null or o.status in ('placed', 'in_production', 'shipped', 'delivered') then
    return 'refunded_after_placement';
  end if;
  update public.print_orders set status = 'cancelled', updated_at = now() where id = p_order and status::text in ('awaiting_artwork', 'paid', 'withheld', 'error');
  update public.gift_sessions set pinned_at = null, expires_at = now() + interval '7 days' where id = s.id;
  return 'cancelled';
end $$;

-- Once the order is with the lab, the session no longer needs to be held: it expires after a short grace period.
create or replace function public.gift_release_session(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.gift_sessions set pinned_at = null, expires_at = now() + interval '7 days' where order_id = p_order and pinned_at is not null;
end $$;

-- Only the service role may call these (the same explicit revokes and grants as 047).
revoke all on function public.gift_link_order(uuid, uuid, uuid, text)                                  from public, anon, authenticated;
revoke all on function public.gift_confirm_order(uuid, uuid, uuid, text, text, jsonb)                  from public, anon, authenticated;
revoke all on function public.gift_reserve_batch(uuid, uuid, text, text[], int)                        from public, anon, authenticated;
revoke all on function public.gift_select_artwork(uuid, uuid, uuid)                                    from public, anon, authenticated;
revoke all on function public.gift_use_correction(uuid, uuid, text)                                    from public, anon, authenticated;
revoke all on function public.gift_approve_order(uuid, uuid, uuid, text, text)                         from public, anon, authenticated;
revoke all on function public.gift_request_refund(uuid, uuid, text, uuid)                              from public, anon, authenticated;
revoke all on function public.gift_decline_refund(uuid)                                                from public, anon, authenticated;
revoke all on function public.gift_apply_refund(uuid, text, int, boolean)                              from public, anon, authenticated;
revoke all on function public.gift_release_session(uuid)                                               from public, anon, authenticated;
revoke all on public.gift_order_lines, public.gift_compositions, public.gift_refund_requests, public.gift_refunds from anon, authenticated;
grant execute on function public.gift_link_order(uuid, uuid, uuid, text)                               to service_role;
grant execute on function public.gift_confirm_order(uuid, uuid, uuid, text, text, jsonb)               to service_role;
grant execute on function public.gift_reserve_batch(uuid, uuid, text, text[], int)                     to service_role;
grant execute on function public.gift_select_artwork(uuid, uuid, uuid)                                 to service_role;
grant execute on function public.gift_use_correction(uuid, uuid, text)                                 to service_role;
grant execute on function public.gift_approve_order(uuid, uuid, uuid, text, text)                      to service_role;
grant execute on function public.gift_request_refund(uuid, uuid, text, uuid)                           to service_role;
grant execute on function public.gift_decline_refund(uuid)                                             to service_role;
grant execute on function public.gift_apply_refund(uuid, text, int, boolean)                           to service_role;
grant execute on function public.gift_release_session(uuid)                                            to service_role;
grant select, insert, update, delete on public.gift_order_lines, public.gift_compositions, public.gift_refund_requests, public.gift_refunds to service_role;
