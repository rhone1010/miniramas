-- 032_foyer_reveals.sql
--
-- THE FOYER'S FREE PERSONAL REVEAL: a lightweight anonymous allowance.
--
-- The homepage turns a visitor's own photograph into one Crafted Image,
-- watermarked, with no account. That costs a real NB2 render, so it is
-- rationed -- lightly. This is abuse protection, not identity: a visitor who
-- changes network and clears their cookies gets more, and that is accepted.
--
-- POLICY (Rich, 2026-09-12)
--   3 SUCCESSFUL reveals per rolling 24 hours.
--   The IP is the primary signal; the browser's liten_anon marker supports it
--   (either reaching the limit stops another reveal).
--   A failed render, a timeout and an age refusal consume nothing.
--   Rows are kept 7 days, then deleted.
--   No photograph -- source or result -- is ever written here.
--   The IP is never stored: the server keeps an HMAC of it under a secret
--   (FOYER_HMAC_SECRET), never the address, never a bare sha256 of it.
--
-- A reveal is CLAIMED before the render starts, under a per-IP advisory lock,
-- so two requests fired together cannot both pass a count of two. It is then
-- FINALIZED: succeeded (it counts) or deleted (it never happened). A claim
-- whose render died without finalizing stops counting after the claim TTL
-- the server passes in.
--
--   claim --render ok--> succeeded      (counts for the window)
--     |
--     +--render failed / timed out--> deleted
--     +--server died--> claimed, ignored once older than the claim TTL
--
-- The foyer's photo intake (the face/age/gender check) is an anonymous call
-- to a vision model, so it is rationed too, by IP, as kind 'intake'.
--
-- The window, the limits and the claim TTL are the server's to pass (one
-- policy file, lib/v1/foyer/foyer-policy.ts); only the 7-day retention lives
-- here, because it is a property of the table.

create table if not exists foyer_reveals (
  id           uuid        primary key default gen_random_uuid(),
  kind         text        not null check (kind in ('reveal', 'intake')),
  ip_hmac      text        not null,
  device_id    text,
  status       text        not null check (status in ('claimed', 'succeeded')),
  created_at   timestamptz not null default now(),
  finalized_at timestamptz
);

create index if not exists idx_foyer_reveals_ip
  on foyer_reveals (ip_hmac, kind, created_at desc);
create index if not exists idx_foyer_reveals_device
  on foyer_reveals (device_id, kind, created_at desc) where device_id is not null;
create index if not exists idx_foyer_reveals_created
  on foyer_reveals (created_at);

-- Service role only. No policies on purpose: browsers never touch this table.
alter table foyer_reveals enable row level security;
revoke all on table foyer_reveals from public, anon, authenticated;

comment on table foyer_reveals is
  'Foyer free-reveal allowance. HMAC of the IP plus the liten_anon marker; no photographs. Rows older than 7 days are deleted by claim_foyer_reveal / claim_foyer_intake.';

-- ── how many reveals count against this visitor right now ────────────────
create or replace function foyer_reveal_count(
  p_ip        text,
  p_device    text,
  p_window    interval,
  p_claim_ttl interval
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from foyer_reveals r
   where r.kind = 'reveal'
     and r.created_at > now() - p_window
     and (r.ip_hmac = p_ip or (p_device is not null and r.device_id = p_device))
     and (r.status = 'succeeded' or r.created_at > now() - p_claim_ttl);
$$;

-- ── claim one reveal, or null when the allowance is used ─────────────────
create or replace function claim_foyer_reveal(
  p_ip        text,
  p_device    text,
  p_limit     integer,
  p_window    interval,
  p_claim_ttl interval
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- IP first, then the device: always in that order, so two claims can never
  -- each hold the lock the other is waiting for.
  perform pg_advisory_xact_lock(hashtextextended('foyer_reveals:ip:' || p_ip, 0));
  if p_device is not null then
    perform pg_advisory_xact_lock(hashtextextended('foyer_reveals:device:' || p_device, 0));
  end if;

  delete from foyer_reveals where created_at < now() - interval '7 days';

  if foyer_reveal_count(p_ip, p_device, p_window, p_claim_ttl) >= p_limit then
    return null;
  end if;

  insert into foyer_reveals (kind, ip_hmac, device_id, status)
  values ('reveal', p_ip, p_device, 'claimed')
  returning id into v_id;
  return v_id;
end;
$$;

-- ── a claimed reveal either counts or never happened ─────────────────────
create or replace function finalize_foyer_reveal(
  p_id        uuid,
  p_succeeded boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_succeeded then
    update foyer_reveals
       set status = 'succeeded', finalized_at = now()
     where id = p_id and kind = 'reveal' and status = 'claimed';
  else
    delete from foyer_reveals
     where id = p_id and kind = 'reveal' and status = 'claimed';
  end if;
  return found;
end;
$$;

-- ── one photo intake (face/age/gender check), or false when capped ───────
create or replace function claim_foyer_intake(
  p_ip     text,
  p_device text,
  p_limit  integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('foyer_reveals:ip:' || p_ip, 0));

  delete from foyer_reveals where created_at < now() - interval '7 days';

  select count(*)::integer into v_n
    from foyer_reveals r
   where r.kind = 'intake' and r.ip_hmac = p_ip and r.created_at > now() - p_window;
  if v_n >= p_limit then
    return false;
  end if;

  insert into foyer_reveals (kind, ip_hmac, device_id, status, finalized_at)
  values ('intake', p_ip, p_device, 'succeeded', now());
  return true;
end;
$$;

-- ── nobody but the server ───────────────────────────────────────────────
revoke execute on function foyer_reveal_count(text, text, interval, interval)            from public, anon, authenticated;
revoke execute on function claim_foyer_reveal(text, text, integer, interval, interval)   from public, anon, authenticated;
revoke execute on function finalize_foyer_reveal(uuid, boolean)                          from public, anon, authenticated;
revoke execute on function claim_foyer_intake(text, text, integer, interval)             from public, anon, authenticated;
grant  execute on function foyer_reveal_count(text, text, interval, interval)            to service_role;
grant  execute on function claim_foyer_reveal(text, text, integer, interval, interval)   to service_role;
grant  execute on function finalize_foyer_reveal(uuid, boolean)                          to service_role;
grant  execute on function claim_foyer_intake(text, text, integer, interval)             to service_role;
