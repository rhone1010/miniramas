-- 059: the GENERATION LEDGER for the compositions-first Gift flow.
--
-- NOT APPLIED. Requires 047 to 058 (050 for gift_free_grants, 057 for the widened batch checks). Additive: new columns with defaults, one new table, new functions, and two widened/added CHECKs
-- and triggers on gift_batches. Existing rows, sessions, packs, batches, previews and compositions keep their meaning; every existing function is left exactly as it was.
--
-- THE NEW FLOW (a session with flow = 'generations'): upload -> choose ONE effect -> choose a product -> generate the personalized composition AT THE PRODUCT'S OWN SHAPE -> accept or retry.
-- The unit is one GENERATION, not a six-preview batch:
--   six free generations per session (gift_generation_slot), then $2.99 for six more (a pack's new `units` column, default 6, so every existing paid pack is worth six generations);
--   the account abuse limits from 050 are kept, re-expressed per generation (parameters, so the numbers can change without a migration);
--   a generation that is never delivered (provider error, refusal) does NOT count: failing releases its free grant and its pack unit;
--   a delivered generation counts, including one that missed the likeness bar (it is delivered and flagged, never blocked);
--   completed generations are kept: any product of the same shape (geometry_key) can reuse one without a new generation.
--
--   gift_sessions.flow            'previews' (the existing six-preview flow, the default: every existing session) | 'generations'
--   gift_generations              the pool of generated compositions (one row per generation), with its own file, hash, quality record and acceptance
--   gift_choose_effect            the ONE effect: creates the session's artwork anchor (a gift_previews row of kind 'generation'), so the existing approval SQL keeps working unchanged
--   gift_reserve_generation       atomic: idempotent per key, allowance check, in-flight cap, grant or pack unit
--   gift_claim / complete / fail  lease, deliver (also readies the anchor), release
--   gift_accept_generation        the customer accepts the composition
--   gift_generation_status        read-only counters for the client
--   gift_compositions.generation_id   which generation a purchased line's composition is (set when the accepted generation is bound to a cart line)
-- A session in the new flow can never take a legacy free or paid batch (trigger), and a legacy session can never get a generation anchor.

alter table public.gift_sessions add column if not exists flow text not null default 'previews';
do $$ begin
  alter table public.gift_sessions add constraint gift_sessions_flow_check check (flow in ('previews', 'generations'));
exception when duplicate_object then null; end $$;

alter table public.gift_preview_packs add column if not exists units int not null default 6;
do $$ begin
  alter table public.gift_preview_packs add constraint gift_preview_packs_units_check check (units > 0);
exception when duplicate_object then null; end $$;

-- gift_batches: a 'generation' batch is the anchor of one chosen effect (one effect, like a collection batch)
alter table public.gift_batches drop constraint if exists gift_batches_kind_check_057;
alter table public.gift_batches drop constraint if exists gift_batches_effects_check_057;
alter table public.gift_batches drop constraint if exists gift_batches_kind_check_059;
alter table public.gift_batches drop constraint if exists gift_batches_effects_check_059;
alter table public.gift_batches add constraint gift_batches_kind_check_059 check (kind in ('free', 'paid', 'collection', 'generation'));
alter table public.gift_batches add constraint gift_batches_effects_check_059
  check ((kind in ('collection', 'generation') and cardinality(effect_ids) = 1) or (kind not in ('collection', 'generation') and cardinality(effect_ids) = 6));

create or replace function public.gift_batches_flow_guard() returns trigger language plpgsql as $$
declare f text;
begin
  select s.flow into f from public.gift_sessions s where s.id = new.session_id;
  if new.kind in ('free', 'paid') and f = 'generations' then raise exception 'legacy_batches_closed'; end if;
  if new.kind = 'generation' and f is distinct from 'generations' then raise exception 'flow_not_generations'; end if;
  return new;
end $$;
drop trigger if exists gift_batches_flow_guard on public.gift_batches;
create trigger gift_batches_flow_guard before insert on public.gift_batches for each row execute function public.gift_batches_flow_guard();

create table if not exists public.gift_generations (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.gift_sessions(id) on delete cascade,
  user_id          uuid not null,
  anchor_id        uuid not null,
  effect_id        text not null,
  product_id       text not null,
  geometry_key     text not null,
  aspect           text not null,
  kind             text not null check (kind in ('free', 'paid')),
  pack_id          uuid references public.gift_preview_packs(id),
  idempotency_key  text not null check (length(idempotency_key) between 8 and 80),
  status           text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  attempts         int  not null default 0,
  lease_until      timestamptz,
  master_path      text,
  preview_path     text,
  width            int,
  height           int,
  sha256           text,
  generation       jsonb,
  error            text,
  accepted_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (session_id, idempotency_key),
  check ((kind = 'paid') = (pack_id is not null)),
  check (status <> 'ready' or (master_path is not null and preview_path is not null and sha256 is not null))
);
create index if not exists gift_generations_session_idx on public.gift_generations(session_id, geometry_key);
create index if not exists gift_generations_pack_idx on public.gift_generations(pack_id) where pack_id is not null;
alter table public.gift_generations enable row level security;

alter table public.gift_free_grants add column if not exists generation_id uuid references public.gift_generations(id) on delete set null;       -- the ledger outlives the session (deleting a session never resets the abuse limits)
alter table public.gift_compositions add column if not exists generation_id uuid references public.gift_generations(id) on delete set null;

-- THE ONE EFFECT: the session's artwork anchor. Idempotent per effect; switching effect is allowed until the order is past 'created' and supersedes compositions of the effect it replaces.
create or replace function public.gift_choose_effect(p_session uuid, p_user uuid, p_effect text)
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; ost text; a uuid; b uuid; n int;
begin
  select * into s from public.gift_sessions where id = p_session for update;
  if not found or s.user_id <> p_user then raise exception 'session_not_found'; end if;
  if s.status <> 'active' or (s.expires_at < now() and s.pinned_at is null) then raise exception 'session_expired'; end if;
  if s.refunded_at is not null then raise exception 'order_refunded'; end if;
  if s.refund_requested_at is not null then raise exception 'refund_pending'; end if;
  if s.flow <> 'generations' and s.collection_preview_id is null then raise exception 'flow_not_generations'; end if;
  if p_effect is null or length(p_effect) not between 1 and 80 then raise exception 'invalid_effect_selection'; end if;
  if s.collection_preview_id is not null then
    select gp.id into a from public.gift_previews gp where gp.id = s.artwork_preview_id and gp.effect_id = p_effect;
    if a is null then raise exception 'effect_fixed'; end if;
    return a;
  end if;
  if s.order_id is not null then
    select status::text into ost from public.print_orders where id = s.order_id;
    if ost is not null and ost <> 'created' then raise exception 'order_not_awaiting_artwork'; end if;
  end if;
  select gp.id into a from public.gift_previews gp where gp.session_id = p_session and gp.effect_id = p_effect;
  if a is null then
    select coalesce(max(batch_index), 0) + 1 into n from public.gift_batches where session_id = p_session;
    insert into public.gift_batches(session_id, user_id, batch_index, kind, pack_id, idempotency_key, effect_ids)
      values (p_session, p_user, n, 'generation', null, 'generation:' || p_effect, array[p_effect]) returning id into b;
    insert into public.gift_previews(batch_id, session_id, slot, effect_id, status) values (b, p_session, 1, p_effect, 'pending') returning id into a;
  end if;
  if s.artwork_preview_id is distinct from a then
    update public.gift_compositions set status = 'superseded' where session_id = p_session and preview_id <> a and status in ('ready', 'approved');
    update public.gift_sessions set artwork_preview_id = a, last_activity_at = now() where id = p_session;
  end if;
  return a;
end $$;

-- ALLOWANCE: which kind of generation the next one is, or 'payment_required'. p_exclude = a generation being (re)reserved, so it does not count against itself.
create or replace function public.gift_generation_slot(p_session uuid, p_user uuid, p_exclude uuid, p_session_cap int default 6, p_photo_cap int default 6, p_24h_cap int default 18, p_total_cap int default 60)
returns table (o_kind text, o_pack uuid)
language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; used int; v_pack uuid; nil uuid := '00000000-0000-0000-0000-000000000000';
begin
  select * into s from public.gift_sessions where id = p_session;
  if not found or s.user_id <> p_user then raise exception 'session_not_found'; end if;
  select count(*) into used from public.gift_generations where session_id = p_session and kind = 'free' and status <> 'failed' and id <> coalesce(p_exclude, nil);
  if used < p_session_cap
     and (select count(*) from public.gift_free_grants where user_id = p_user and source_sha256 = s.source_sha256 and generation_id is distinct from p_exclude) < p_photo_cap
     and (select count(*) from public.gift_free_grants where user_id = p_user and created_at > now() - interval '24 hours' and generation_id is distinct from p_exclude) < p_24h_cap
     and (select count(*) from public.gift_free_grants where user_id = p_user and generation_id is distinct from p_exclude) < p_total_cap then
    return query select 'free'::text, null::uuid; return;
  end if;
  select p.id into v_pack from public.gift_preview_packs p
    where p.user_id = p_user and p.status = 'paid'
      and p.units > (select count(*) from public.gift_generations g where g.pack_id = p.id and g.status <> 'failed' and g.id <> coalesce(p_exclude, nil))
    order by p.paid_at, p.id limit 1 for update of p skip locked;
  if v_pack is null then raise exception 'payment_required'; end if;
  return query select 'paid'::text, v_pack;
end $$;

create or replace function public.gift_reserve_generation(p_session uuid, p_user uuid, p_key text, p_product text, p_geometry text, p_aspect text,
  p_session_cap int default 6, p_photo_cap int default 6, p_24h_cap int default 18, p_total_cap int default 60, p_max_inflight int default 2)
returns table (o_generation_id uuid, o_kind text, o_reused boolean, o_status text)
language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; o record; g public.gift_generations; eff text; k record; inflight int; new_id uuid; v_used int; v_units int;
begin
  select * into s from public.gift_sessions where id = p_session for update;
  if not found or s.user_id <> p_user then raise exception 'session_not_found'; end if;
  if s.status <> 'active' or (s.expires_at < now() and s.pinned_at is null) then raise exception 'session_expired'; end if;
  if s.flow <> 'generations' and s.collection_preview_id is null then raise exception 'flow_not_generations'; end if;
  if s.refunded_at is not null then raise exception 'order_refunded'; end if;
  if s.refund_requested_at is not null then raise exception 'refund_pending'; end if;
  if s.order_id is not null then
    select status::text as status into o from public.print_orders where id = s.order_id;
    if found and o.status not in ('created', 'awaiting_artwork', 'cancelled') then raise exception 'order_not_awaiting_artwork'; end if;
  end if;
  if s.artwork_preview_id is null then raise exception 'effect_not_chosen'; end if;
  select gp.effect_id into eff from public.gift_previews gp where gp.id = s.artwork_preview_id;
  if p_key is null or length(p_key) not between 8 and 80 then raise exception 'invalid_idempotency_key'; end if;

  select * into g from public.gift_generations where session_id = p_session and idempotency_key = p_key;
  if found then
    if g.status = 'failed' then                                   -- a retry of a failed one: it must find a slot again (a failure released its own)
      select * into k from public.gift_generation_slot(p_session, p_user, g.id, p_session_cap, p_photo_cap, p_24h_cap, p_total_cap);
      update public.gift_generations set status = 'pending', kind = k.o_kind, pack_id = k.o_pack, error = null, lease_until = null, updated_at = now() where id = g.id;
      if k.o_kind = 'free' then insert into public.gift_free_grants(user_id, source_sha256, session_id, generation_id) values (p_user, s.source_sha256, p_session, g.id); end if;
      if k.o_pack is not null then
        select p.units into v_units from public.gift_preview_packs p where p.id = k.o_pack;
        select count(*) into v_used from public.gift_generations x where x.pack_id = k.o_pack and x.status <> 'failed';
        if v_used >= v_units then update public.gift_preview_packs set status = 'consumed', consumed_at = now() where id = k.o_pack; end if;
      end if;
      return query select g.id, k.o_kind, true, 'pending'::text; return;
    end if;
    return query select g.id, g.kind, true, g.status; return;
  end if;

  select count(*) into inflight from public.gift_generations where session_id = p_session and (status = 'pending' or (status = 'generating' and lease_until > now()));
  if inflight >= p_max_inflight then raise exception 'generation_in_progress'; end if;

  select * into k from public.gift_generation_slot(p_session, p_user, null, p_session_cap, p_photo_cap, p_24h_cap, p_total_cap);
  insert into public.gift_generations(session_id, user_id, anchor_id, effect_id, product_id, geometry_key, aspect, kind, pack_id, idempotency_key)
    values (p_session, p_user, s.artwork_preview_id, eff, p_product, p_geometry, p_aspect, k.o_kind, k.o_pack, p_key) returning id into new_id;
  if k.o_kind = 'free' then insert into public.gift_free_grants(user_id, source_sha256, session_id, generation_id) values (p_user, s.source_sha256, p_session, new_id); end if;
  if k.o_pack is not null then
    select p.units into v_units from public.gift_preview_packs p where p.id = k.o_pack;
    select count(*) into v_used from public.gift_generations x where x.pack_id = k.o_pack and x.status <> 'failed';
    if v_used >= v_units then update public.gift_preview_packs set status = 'consumed', consumed_at = now() where id = k.o_pack; end if;
  end if;
  update public.gift_sessions set last_activity_at = now(),
    expires_at = least(created_at + interval '30 days', greatest(expires_at, now() + interval '7 days')) where id = p_session and pinned_at is null;
  update public.gift_sessions set last_activity_at = now() where id = p_session and pinned_at is not null;
  return query select new_id, k.o_kind, false, 'pending'::text;
end $$;

create or replace function public.gift_claim_generation(p_gen uuid, p_user uuid, p_lease_seconds int default 300, p_max_attempts int default 3)
returns public.gift_generations language plpgsql security definer set search_path = public as $$
declare r public.gift_generations;
begin
  update public.gift_generations gg
     set status = 'generating', attempts = gg.attempts + 1, lease_until = now() + make_interval(secs => p_lease_seconds), updated_at = now(), error = null
   where gg.id = p_gen and gg.user_id = p_user and gg.attempts < p_max_attempts
     and (gg.status = 'pending' or (gg.status = 'generating' and gg.lease_until < now()))
     and exists (select 1 from public.gift_sessions s where s.id = gg.session_id and s.user_id = p_user and s.status = 'active')
  returning gg.* into r;
  return r;
end $$;

create or replace function public.gift_complete_generation(p_gen uuid, p_user uuid, p_master text, p_preview text, p_w int, p_h int, p_sha text, p_record jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare g public.gift_generations;
begin
  update public.gift_generations set status = 'ready', lease_until = null, error = null, master_path = p_master, preview_path = p_preview, width = p_w, height = p_h, sha256 = p_sha,
         generation = p_record, updated_at = now()
   where id = p_gen and user_id = p_user and status in ('generating', 'pending') returning * into g;
  if not found then return false; end if;
  update public.gift_previews set status = 'ready', master_path = p_master, preview_path = p_preview, width = p_w, height = p_h, updated_at = now()
   where id = g.anchor_id and status <> 'ready';                    -- the anchor shows the first delivered composition (it is also what the one My Collection piece is made from)
  return true;
end $$;

create or replace function public.gift_fail_generation(p_gen uuid, p_user uuid, p_error text)
returns void language plpgsql security definer set search_path = public as $$
declare g public.gift_generations; v_used int; v_units int;
begin
  update public.gift_generations set status = 'failed', lease_until = null, error = left(coalesce(p_error, 'generation_failed'), 200), updated_at = now()
   where id = p_gen and user_id = p_user and status <> 'ready' returning * into g;
  if not found then return; end if;
  delete from public.gift_free_grants where generation_id = g.id;       -- a generation that was never delivered is not counted
  if g.pack_id is not null then
    select p.units into v_units from public.gift_preview_packs p where p.id = g.pack_id;
    select count(*) into v_used from public.gift_generations x where x.pack_id = g.pack_id and x.status <> 'failed';
    update public.gift_preview_packs set status = 'paid', consumed_at = null where id = g.pack_id and status = 'consumed' and consumed_batch_id is null and v_units > v_used;
  end if;
end $$;

create or replace function public.gift_accept_generation(p_session uuid, p_user uuid, p_gen uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; g public.gift_generations; t timestamptz;
begin
  select * into s from public.gift_sessions where id = p_session for update;
  if not found or s.user_id <> p_user then raise exception 'session_not_found'; end if;
  select * into g from public.gift_generations where id = p_gen and session_id = p_session;
  if not found then raise exception 'generation_not_found'; end if;
  if g.status <> 'ready' then raise exception 'generation_not_ready'; end if;
  if s.refunded_at is not null then raise exception 'order_refunded'; end if;
  if s.refund_requested_at is not null then raise exception 'refund_pending'; end if;
  update public.gift_generations set accepted_at = coalesce(accepted_at, now()) where id = p_gen returning accepted_at into t;
  update public.gift_sessions set last_activity_at = now() where id = p_session;
  return t;
end $$;

create or replace function public.gift_generation_status(p_session uuid, p_user uuid, p_session_cap int default 6, p_photo_cap int default 6, p_24h_cap int default 18, p_total_cap int default 60)
returns table (o_free_used int, o_free_available boolean, o_reason text, o_paid_units int)
language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; used int; paid int;
begin
  select * into s from public.gift_sessions where id = p_session;
  if not found or s.user_id <> p_user then raise exception 'session_not_found'; end if;
  select count(*) into used from public.gift_generations where session_id = p_session and kind = 'free' and status <> 'failed';
  select coalesce(sum(p.units - (select count(*) from public.gift_generations g where g.pack_id = p.id and g.status <> 'failed')), 0)::int into paid
    from public.gift_preview_packs p where p.user_id = p_user and p.status = 'paid';
  if used >= p_session_cap then return query select used, false, 'session_limit'::text, paid; return; end if;
  if (select count(*) from public.gift_free_grants where user_id = p_user and source_sha256 = s.source_sha256) >= p_photo_cap then return query select used, false, 'photo_limit'::text, paid; return; end if;
  if (select count(*) from public.gift_free_grants where user_id = p_user and created_at > now() - interval '24 hours') >= p_24h_cap then return query select used, false, 'daily_limit'::text, paid; return; end if;
  if (select count(*) from public.gift_free_grants where user_id = p_user) >= p_total_cap then return query select used, false, 'lifetime_limit'::text, paid; return; end if;
  return query select used, true, null::text, paid;
end $$;

revoke all on public.gift_generations from anon, authenticated;
grant select, insert, update, delete on public.gift_generations to service_role;
revoke all on function public.gift_choose_effect(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.gift_generation_slot(uuid, uuid, uuid, int, int, int, int) from public, anon, authenticated;
revoke all on function public.gift_reserve_generation(uuid, uuid, text, text, text, text, int, int, int, int, int) from public, anon, authenticated;
revoke all on function public.gift_claim_generation(uuid, uuid, int, int) from public, anon, authenticated;
revoke all on function public.gift_complete_generation(uuid, uuid, text, text, int, int, text, jsonb) from public, anon, authenticated;
revoke all on function public.gift_fail_generation(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.gift_accept_generation(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.gift_generation_status(uuid, uuid, int, int, int, int) from public, anon, authenticated;
grant execute on function public.gift_choose_effect(uuid, uuid, text) to service_role;
grant execute on function public.gift_generation_slot(uuid, uuid, uuid, int, int, int, int) to service_role;
grant execute on function public.gift_reserve_generation(uuid, uuid, text, text, text, text, int, int, int, int, int) to service_role;
grant execute on function public.gift_claim_generation(uuid, uuid, int, int) to service_role;
grant execute on function public.gift_complete_generation(uuid, uuid, text, text, int, int, text, jsonb) to service_role;
grant execute on function public.gift_fail_generation(uuid, uuid, text) to service_role;
grant execute on function public.gift_accept_generation(uuid, uuid, uuid) to service_role;
grant execute on function public.gift_generation_status(uuid, uuid, int, int, int, int) to service_role;
