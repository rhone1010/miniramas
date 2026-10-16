-- 047_gift_wizard_sessions.sql
--
-- Gift Wizard sessions, six-preview batches and paid preview packs.
--
-- NOT APPLIED. Review, then run in the Supabase SQL editor. Additive only: new tables and functions, nothing existing is
-- altered. Every table is service-role only (RLS on, no policies): the browser never reads these rows; the API does.
--
-- THE RULES THESE TABLES ENFORCE
--   * A session belongs to ONE signed-in user. Every function takes the user and refuses another owner's session.
--   * (Superseded by 048, which must be applied right after this one: free batches then come from the PAID product order, two per
--     order, and generation needs a paid order. Until 048 is applied nothing in the app calls these functions.)
--   * Batches 1 and 2 of a session are free. Every later batch consumes one PAID pack. A pack exists only after the
--     Stripe webhook verified payment (gift_fulfill_preview_pack); there is no way to create a paid pack from a client.
--   * A batch is exactly six previews with six DISTINCT effects, and an effect is never used twice in a session.
--   * Reserving a batch is idempotent per (session, idempotency key): a repeat returns the same batch and consumes
--     nothing. A failed preview is retried on its own row: successful previews are never regenerated, nothing is charged.
--   * A new batch cannot be reserved while an earlier batch still has previews that are not ready, so a customer
--     cannot spend a pack while paid-for previews are still missing.
--   * A paid pack belongs to the USER, not the session, so it survives session expiry and can be used (restored) later.

create table if not exists public.gift_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  status           text not null default 'active' check (status in ('active', 'expired', 'deleted')),
  source_path      text,
  source_sha256    text not null,
  source_width     int  not null check (source_width > 0),
  source_height    int  not null check (source_height > 0),
  series           text check (series in ('portraits', 'pets', 'groups')),
  analysis         jsonb not null default '{}'::jsonb,
  lines            jsonb not null default '[]'::jsonb,
  master_aspect    text,
  created_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at       timestamptz not null,
  -- Set by the (future) checkout phase when an artwork from this session enters an order: cleanup then leaves it alone.
  pinned_at        timestamptz
);
create index if not exists gift_sessions_user_idx on public.gift_sessions(user_id, status);
create index if not exists gift_sessions_expiry_idx on public.gift_sessions(expires_at) where status = 'active' and pinned_at is null;

create table if not exists public.gift_preview_packs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,
  stripe_session_id   text not null unique,
  amount_cents        int  not null check (amount_cents > 0),
  status              text not null default 'paid' check (status in ('paid', 'consumed', 'refunded')),
  created_at          timestamptz not null default now(),
  paid_at             timestamptz not null default now(),
  consumed_at         timestamptz,
  consumed_batch_id   uuid
);
create index if not exists gift_preview_packs_user_idx on public.gift_preview_packs(user_id, status, paid_at);

create table if not exists public.gift_batches (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.gift_sessions(id) on delete cascade,
  user_id          uuid not null,
  batch_index      int  not null check (batch_index >= 1),
  kind             text not null check (kind in ('free', 'paid')),
  pack_id          uuid references public.gift_preview_packs(id),
  idempotency_key  text not null check (length(idempotency_key) between 8 and 80),
  effect_ids       text[] not null check (cardinality(effect_ids) = 6),
  created_at       timestamptz not null default now(),
  unique (session_id, batch_index),
  unique (session_id, idempotency_key),
  check ((kind = 'paid') = (pack_id is not null))
);

create table if not exists public.gift_previews (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid not null references public.gift_batches(id) on delete cascade,
  session_id     uuid not null references public.gift_sessions(id) on delete cascade,
  slot           int  not null check (slot between 1 and 6),
  effect_id      text not null,
  status         text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  attempts       int  not null default 0,
  lease_until    timestamptz,
  master_path    text,
  preview_path   text,
  width          int,
  height         int,
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (batch_id, slot),
  unique (session_id, effect_id),
  check (status <> 'ready' or (master_path is not null and preview_path is not null))
);

alter table public.gift_sessions      enable row level security;
alter table public.gift_preview_packs enable row level security;
alter table public.gift_batches       enable row level security;
alter table public.gift_previews      enable row level security;

-- Reserve the next batch for a session. Idempotent per key; consumes a paid pack from the third batch on.
create or replace function public.gift_reserve_batch(p_session uuid, p_user uuid, p_key text, p_effects text[], p_free int default 2)
returns table (o_batch_id uuid, o_batch_index int, o_kind text, o_reused boolean)
language plpgsql security definer set search_path = public as $$
declare
  s public.gift_sessions;
  existing public.gift_batches;
  n int;
  v_kind text;
  v_pack uuid;
  v_batch uuid;
  i int;
begin
  select * into s from public.gift_sessions where id = p_session for update;
  if not found or s.user_id <> p_user then raise exception 'session_not_found'; end if;
  if s.status <> 'active' or s.expires_at < now() then raise exception 'session_expired'; end if;

  select * into existing from public.gift_batches where session_id = p_session and idempotency_key = p_key;
  if found then
    return query select existing.id, existing.batch_index, existing.kind, true;
    return;
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
  if n < p_free then
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
  -- Retention: activity extends expiry to 7 days ahead, but never past 30 days from creation.
  update public.gift_sessions set last_activity_at = now(),
    expires_at = least(created_at + interval '30 days', greatest(expires_at, now() + interval '7 days')) where id = p_session;
  return query select v_batch, n + 1, v_kind, false;
end $$;

-- Take the lease on one preview so exactly one worker generates it. A ready preview is never claimed again.
create or replace function public.gift_claim_preview(p_preview uuid, p_user uuid, p_lease_seconds int default 300, p_max_attempts int default 3)
returns public.gift_previews
language plpgsql security definer set search_path = public as $$
declare r public.gift_previews;
begin
  update public.gift_previews gp
     set status = 'generating', attempts = gp.attempts + 1, lease_until = now() + make_interval(secs => p_lease_seconds), updated_at = now(), error = null
   where gp.id = p_preview
     and gp.attempts < p_max_attempts
     and (gp.status in ('pending', 'failed') or (gp.status = 'generating' and gp.lease_until < now()))
     and exists (select 1 from public.gift_sessions s where s.id = gp.session_id and s.user_id = p_user and s.status = 'active')
  returning gp.* into r;
  return r;
end $$;

-- Record a paid pack. Called ONLY by the Stripe webhook path after the session was retrieved from Stripe and verified.
create or replace function public.gift_fulfill_preview_pack(p_user uuid, p_stripe_session text, p_amount int)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  insert into public.gift_preview_packs(user_id, stripe_session_id, amount_cents) values (p_user, p_stripe_session, p_amount)
    on conflict (stripe_session_id) do nothing returning id into v;
  if v is null then select id into v from public.gift_preview_packs where stripe_session_id = p_stripe_session; end if;
  return v;
end $$;

-- Only the service role may call these. (Migration 046 taught us that `revoke ... from public` also removes the
-- service role's EXECUTE, so it is granted explicitly.)
revoke all on function public.gift_reserve_batch(uuid, uuid, text, text[], int)    from public;
revoke all on function public.gift_claim_preview(uuid, uuid, int, int)             from public;
revoke all on function public.gift_fulfill_preview_pack(uuid, text, int)           from public;
-- Supabase can grant new objects to anon and authenticated through default privileges, which `revoke ... from public`
-- does not undo. Remove them explicitly so only the service role has any access, whatever the project's defaults are.
revoke all on function public.gift_reserve_batch(uuid, uuid, text, text[], int)    from anon, authenticated;
revoke all on function public.gift_claim_preview(uuid, uuid, int, int)             from anon, authenticated;
revoke all on function public.gift_fulfill_preview_pack(uuid, text, int)           from anon, authenticated;
revoke all on public.gift_sessions, public.gift_preview_packs, public.gift_batches, public.gift_previews from anon, authenticated;
grant execute on function public.gift_reserve_batch(uuid, uuid, text, text[], int) to service_role;
grant execute on function public.gift_claim_preview(uuid, uuid, int, int)          to service_role;
grant execute on function public.gift_fulfill_preview_pack(uuid, text, int)        to service_role;
grant select, insert, update, delete on public.gift_sessions, public.gift_preview_packs, public.gift_batches, public.gift_previews to service_role;
