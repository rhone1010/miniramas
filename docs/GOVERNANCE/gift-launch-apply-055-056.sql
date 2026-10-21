-- GIFT LAUNCH MIGRATIONS 055 + 056, in order, in ONE transaction (a failure rolls both back). Paste into the Supabase SQL Editor of the target project and run once.
-- GENERATED: this file is exactly 055 then 056; lib/v1/gift/launch-bundle.test.ts fails if it drifts. Both are additive and idempotent (safe to re-run).
-- Before: run docs/GOVERNANCE/gift-composition-jobs-055-preflight-and-verify.sql and docs/GOVERNANCE/gift-056-preflight-and-verify.sql (read-only) and expect "not applied yet".
-- After: run the same two files; expect nothing FAIL and nothing "not yet".
-- Dependencies verified on the target 2026-10-21 (read-only): 047, 048, 049, 052 present; 046 present; 055 and 056 absent; no gift session has been released (approved_at) yet.
begin;

-- ===== 055_gift_composition_jobs.sql =====
-- 055_gift_composition_jobs.sql
--
-- DURABLE POST-PURCHASE COMPOSITION STATUS AND RECOVERY. NOT APPLIED. Additive and idempotent. Changes no existing table, function, row or permission.
--
-- Until now preparing a gift's product-shaped artwork (a deterministic adaptation, or an NB2.1 generation plus bounded extension) left no durable trace while it ran: two requests could
-- generate the same artwork twice (paid), a refresh could not tell "being prepared" from "never started", and a request that died left nothing to resume from.
--
--   gift_composition_jobs     one row per (session, selected artwork, composition requirement = geometry key) while it is being prepared or after it failed. A SUCCESSFUL job is deleted:
--                             the gift_compositions rows it produced are the record. state 'preparing' with an unexpired lease = in progress; an expired lease = stalled (resumable);
--                             state 'failed' = the last attempt failed with error_code (resumable until attempts is used up).
--   gift_claim_composition    take the job atomically (ONE statement: insert, or take over an expired or failed one while attempts remain). Returns the token, or null with the reason
--                             'in_progress' (someone else is preparing it) or 'attempts_exhausted'. This is the guard against paying for the same generation twice.
--   gift_finish_composition   the holder succeeded: drop the job. A wrong token does nothing.
--   gift_fail_composition     the holder failed: keep the job as 'failed' with a short code. A wrong token does nothing.
-- Service role only. Per the rule in 054, every object below grants service_role explicitly and nothing to the browser roles.

create table if not exists public.gift_composition_jobs (
  session_id    uuid not null references public.gift_sessions(id) on delete cascade,
  preview_id    uuid not null,
  geometry_key  text not null,
  line_ids      text[] not null default '{}',
  method        text check (method in ('deterministic', 'generated')),
  state         text not null default 'preparing' check (state in ('preparing', 'failed')),
  token         uuid not null default gen_random_uuid(),
  attempts      int  not null default 1 check (attempts >= 1),
  claimed_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  error_code    text,
  updated_at    timestamptz not null default now(),
  primary key (session_id, preview_id, geometry_key)
);
alter table public.gift_composition_jobs enable row level security;

create or replace function public.gift_claim_composition(p_session uuid, p_preview uuid, p_geometry text, p_lines text[], p_method text, p_ttl_seconds int default 600, p_max_attempts int default 3)
returns table (o_token uuid, o_reason text)
language plpgsql security definer set search_path = public as $$
declare t uuid; cur public.gift_composition_jobs;
begin
  -- One statement: either this call inserts the job, or it takes over an EXPIRED or FAILED one that still has attempts left, or it changes nothing and t stays null.
  insert into public.gift_composition_jobs(session_id, preview_id, geometry_key, line_ids, method, expires_at)
    values (p_session, p_preview, p_geometry, coalesce(p_lines, '{}'), p_method, now() + make_interval(secs => greatest(30, p_ttl_seconds)))
  on conflict (session_id, preview_id, geometry_key) do update
    set state = 'preparing', token = gen_random_uuid(), attempts = public.gift_composition_jobs.attempts + 1, claimed_at = now(), updated_at = now(),
        expires_at = excluded.expires_at, line_ids = excluded.line_ids, method = excluded.method, error_code = null
    where (public.gift_composition_jobs.expires_at <= now() or public.gift_composition_jobs.state = 'failed') and public.gift_composition_jobs.attempts < p_max_attempts
  returning token into t;
  if t is not null then return query select t, 'claimed'::text; return; end if;
  select * into cur from public.gift_composition_jobs where session_id = p_session and preview_id = p_preview and geometry_key = p_geometry;
  return query select null::uuid, case when cur.attempts >= p_max_attempts and (cur.expires_at <= now() or cur.state = 'failed') then 'attempts_exhausted' else 'in_progress' end;
end $$;

create or replace function public.gift_finish_composition(p_session uuid, p_preview uuid, p_geometry text, p_token uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.gift_composition_jobs where session_id = p_session and preview_id = p_preview and geometry_key = p_geometry and token = p_token;
end $$;

create or replace function public.gift_fail_composition(p_session uuid, p_preview uuid, p_geometry text, p_token uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.gift_composition_jobs set state = 'failed', error_code = left(coalesce(p_code, 'composition_failed'), 60), expires_at = now(), updated_at = now()
    where session_id = p_session and preview_id = p_preview and geometry_key = p_geometry and token = p_token;
end $$;

revoke all on function public.gift_claim_composition(uuid, uuid, text, text[], text, int, int) from public, anon, authenticated;
revoke all on function public.gift_finish_composition(uuid, uuid, text, uuid)                   from public, anon, authenticated;
revoke all on function public.gift_fail_composition(uuid, uuid, text, uuid, text)               from public, anon, authenticated;
revoke all on public.gift_composition_jobs from anon, authenticated;
grant execute on function public.gift_claim_composition(uuid, uuid, text, text[], text, int, int) to service_role;
grant execute on function public.gift_finish_composition(uuid, uuid, text, uuid)                   to service_role;
grant execute on function public.gift_fail_composition(uuid, uuid, text, uuid, text)               to service_role;
grant select, insert, update, delete on public.gift_composition_jobs to service_role;

-- ===== 056_gift_final_approval.sql =====
-- 056: Gift Wizard FINAL APPROVAL is separate from RELEASE TO MANUFACTURING.
--
-- NOT APPLIED. Requires 048 (and 052 only for the repair paths, which it does not touch). Additive and idempotent.
--
-- Until now gift_approve_order did both in one transaction: it recorded the customer's approval AND moved print_orders from 'awaiting_artwork'
-- (invisible to fulfilment) to 'paid' (the one state the fulfilment poller, completePrintOrder and the retry paths act on). So the customer's final
-- button was also the manufacturing trigger. This migration splits that:
--
--   gift_sessions.final_approved_at   the customer's final order approval, recorded durably. Nothing else changes when it is set.
--   gift_finalize_order(...)          validates exactly what gift_approve_order validated (paid order, selected artwork, every purchased line has an
--                                     APPROVED composition of that artwork, no refund or refund request), creates the one unlocked My Collection piece
--                                     (idempotent), sets final_approved_at. It NEVER touches print_orders, so the order stays 'awaiting_artwork':
--                                     invisible to fulfilment. Safe to repeat and to race: the session row is locked, a repeat returns 'already'.
--   gift_release_order(session)       the separate, explicit step: requires final_approved_at, then 'awaiting_artwork' -> 'paid' and approved_at = now()
--                                     (approved_at keeps its meaning for the fulfilment code: "released"). Service role only; no customer route calls it.
--
-- gift_approve_order (048) is left exactly as it was, for rows and tests that predate this; the application no longer calls it. A session that was
-- approved and released before 056 has approved_at set and final_approved_at null; the application reads "final approval" as
-- coalesce(final_approved_at, approved_at), so nothing that already happened changes meaning.

alter table public.gift_sessions add column if not exists final_approved_at timestamptz;

create or replace function public.gift_finalize_order(p_session uuid, p_user uuid, p_portfolio uuid, p_clean_path text, p_source_image text)
returns text language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; ost text; pv record; identity_key text;
begin
  select * into s from public.gift_sessions where id = p_session for update;
  if not found or s.user_id <> p_user then raise exception 'session_not_found'; end if;
  if s.order_id is null then raise exception 'order_payment_required'; end if;
  if s.refunded_at is not null then raise exception 'order_refunded'; end if;
  if s.refund_requested_at is not null then raise exception 'refund_pending'; end if;
  if s.final_approved_at is not null or s.approved_at is not null then return 'already'; end if;
  select status::text into ost from public.print_orders where id = s.order_id for update;
  if ost <> 'awaiting_artwork' then raise exception 'order_not_awaiting_artwork'; end if;
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

  -- The ONLY write to the order's lifecycle: the customer's approval. print_orders is not touched.
  update public.gift_sessions set final_approved_at = now(), last_activity_at = now() where id = s.id;
  return 'approved';
end $$;

create or replace function public.gift_release_order(p_session uuid)
returns text language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; ost text;
begin
  select * into s from public.gift_sessions where id = p_session for update;
  if not found then raise exception 'session_not_found'; end if;
  if s.order_id is null then raise exception 'order_payment_required'; end if;
  if s.refunded_at is not null then raise exception 'order_refunded'; end if;
  if s.refund_requested_at is not null then raise exception 'refund_pending'; end if;
  if s.approved_at is not null then return 'already'; end if;
  if s.final_approved_at is null then raise exception 'final_approval_required'; end if;
  select status::text into ost from public.print_orders where id = s.order_id for update;
  if ost <> 'awaiting_artwork' then raise exception 'order_not_awaiting_artwork'; end if;
  update public.print_orders set status = 'paid', updated_at = now() where id = s.order_id and status::text = 'awaiting_artwork';
  update public.gift_sessions set approved_at = now(), last_activity_at = now() where id = s.id;
  return 'released';
end $$;

revoke all on function public.gift_finalize_order(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.gift_release_order(uuid)                          from public, anon, authenticated;
grant execute on function public.gift_finalize_order(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.gift_release_order(uuid)                          to service_role;

commit;
