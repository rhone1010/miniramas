-- 060: source photograph retention (60 days). NOT APPLIED. Written 2026-10-25; apply only with Rich's authorization.
--
-- Policy (approved): a customer's SOURCE photograph is deleted 60 days after
--   * creation, for unpurchased work;
--   * the qualifying purchase or Collection unlock, for Portraits, Pets and Groups;
--   * customer artwork approval, for Gift Shop (handled in application code: gift/{session}/source.jpg).
-- An open dispute suspends deletion. Crafted/generated artwork, approved manufacturing files and financial records are never touched.
--
-- What this migration does NOT do: it deletes nothing by itself. The sweep function only deletes when called with p_apply = true, and the
-- application route calls it with p_apply = false unless SOURCE_RETENTION_DELETE=1. Run it with p_apply = false first and read the result.
--
-- The only place a Portraits/Pets/Groups source photograph lives is portfolios.source_image (base64 text; no storage object, no thumbnail).
-- The remedy system keeps working after deletion because the photograph's identity hash is kept (source_sha256, the same value
-- lib/store/remedy-evidence.ts computes), so repeat-refund detection survives. A redo needs the photograph and therefore asks for a better one.

begin;

alter table public.portfolios
  add column if not exists source_sha256 text,
  add column if not exists source_deleted_at timestamptz;

create table if not exists public.retention_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null,                 -- 'portfolio_source'
  subject_id text not null,           -- the portfolio id (never any photograph content)
  action text not null,               -- 'deleted'
  detail jsonb not null default '{}'::jsonb
);
alter table public.retention_log enable row level security;       -- no policies: service role only
revoke all on public.retention_log from anon, authenticated;

-- The same value as hashRemedyIdentity(canonical base64 of the image bytes): sha256 of the base64 text.
create or replace function public.retention_source_hash(p_source text) returns text
language plpgsql immutable as $$
declare b64 text;
begin
  b64 := regexp_replace(coalesce(p_source, ''), '^data:[^,]*,', '');
  b64 := regexp_replace(b64, '\s', '', 'g');
  if length(b64) < 16 then return null; end if;
  return encode(sha256(convert_to(replace(encode(decode(b64, 'base64'), 'base64'), E'\n', ''), 'UTF8')), 'hex');
exception when others then
  return null;
end $$;

-- An open dispute for this portfolio: an unresolved Make It Right case that names it (or that is not scoped to one artwork), or an open
-- Gift refund request on the session that made it. Anything not 'resolved' is open (requested, reviewing, awaiting_photo, authorized, executing).
create or replace function public.retention_portfolio_disputed(p_portfolio uuid, p_user uuid, p_gift_session uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.support_messages s
     where s.user_id = p_user
       and s.context #>> '{case,kind}' = 'make_it_right'
       and coalesce(s.context #>> '{case,status}', 'requested') <> 'resolved'
       and (coalesce(s.context #>> '{case,scope}', 'batch') <> 'artwork' or s.context #>> '{case,artwork,portfolioId}' = p_portfolio::text)
  ) or (p_gift_session is not null and (
    exists (select 1 from public.gift_refund_requests r where r.session_id = p_gift_session and r.status = 'requested')
    or exists (select 1 from public.gift_sessions g where g.id = p_gift_session and g.refund_requested_at is not null and g.refunded_at is null)
  ));
$$;

-- Is this Gift session in dispute? (the application sweep for gift/{session}/source.jpg uses it)
create or replace function public.retention_gift_session_disputed(p_session uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.gift_refund_requests r where r.session_id = p_session and r.status = 'requested')
      or exists (select 1 from public.gift_sessions g where g.id = p_session and g.refund_requested_at is not null and g.refunded_at is null)
      or exists (
        select 1 from public.gift_sessions g join public.support_messages s on s.user_id = g.user_id
         where g.id = p_session
           and s.context #>> '{case,kind}' = 'make_it_right'
           and coalesce(s.context #>> '{case,status}', 'requested') <> 'resolved'
           and (coalesce(s.context #>> '{case,scope}', 'batch') <> 'artwork' or s.context #>> '{case,artwork,portfolioId}' = g.unlock_portfolio_id::text));
$$;

-- The sweep. One row per portfolio whose source photograph is still held and whose 60 days have run out on the CREATION clock (the earliest
-- any clock can expire); the qualifying purchase / unlock / approval moves the real clock later. delete_after is that real clock + 60 days.
create or replace function public.retention_sweep_portfolio_sources(p_now timestamptz, p_limit integer, p_apply boolean)
returns table(portfolio_id uuid, delete_after timestamptz, disputed boolean, due boolean, deleted boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.portfolios; paid timestamptz; unlocked timestamptz; gsess uuid; gapproved timestamptz; clock timestamptz; d boolean; busy boolean; done integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('retention:portfolio-sources', 0));
  for r in
    select * from public.portfolios p
     where p.source_image is not null and p.created_at <= p_now - interval '60 days'
     order by p.created_at
     for update skip locked
  loop
    exit when p_limit > 0 and done >= p_limit;
    gsess := null; gapproved := null;
    if r.origin = 'gift' and r.composition #>> '{gift,session}' ~ '^[0-9a-fA-F-]{36}$' then
      gsess := (r.composition #>> '{gift,session}')::uuid;
      select coalesce(g.final_approved_at, g.approved_at) into gapproved from public.gift_sessions g where g.id = gsess;
      clock := coalesce(gapproved, r.created_at);                     -- Gift Shop: approval starts the clock
    else
      select max(pu.paid_at) into paid from public.purchases pu where pu.id = r.purchase_id and pu.status = 'paid';
      select max(l.unlocked_at) into unlocked from public.portfolio_items i join public.preview_ledger l on l.id = i.preview_id where i.portfolio_id = r.id;
      clock := coalesce(greatest(paid, unlocked), r.created_at);      -- purchase or Collection unlock (the later one); otherwise creation
    end if;
    portfolio_id := r.id; delete_after := clock + interval '60 days'; deleted := false;
    d := public.retention_portfolio_disputed(r.id, r.user_id, gsess);
    -- still being crafted: a render in flight needs its photograph (a render stuck for over a week is dead and does not count)
    busy := exists (select 1 from public.portfolio_items i where i.portfolio_id = r.id and i.status not in ('done', 'failed') and coalesce(i.rendering_started_at, i.created_at) > p_now - interval '7 days');
    disputed := d; due := delete_after <= p_now and not d and not busy;
    if due then
      done := done + 1;
      if p_apply then
        update public.portfolios set source_sha256 = coalesce(source_sha256, public.retention_source_hash(source_image)), source_image = null, source_deleted_at = p_now where id = r.id and source_image is not null;
        insert into public.retention_log(kind, subject_id, action, detail) values ('portfolio_source', r.id::text, 'deleted', jsonb_build_object('clock', clock, 'delete_after', delete_after, 'at', p_now));
        deleted := true;
      end if;
    end if;
    return next;
  end loop;
end $$;

revoke all on function public.retention_sweep_portfolio_sources(timestamptz, integer, boolean) from public, anon, authenticated;
revoke all on function public.retention_gift_session_disputed(uuid) from public, anon, authenticated;
revoke all on function public.retention_portfolio_disputed(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.retention_sweep_portfolio_sources(timestamptz, integer, boolean) to service_role;
grant execute on function public.retention_gift_session_disputed(uuid) to service_role;
grant execute on function public.retention_portfolio_disputed(uuid, uuid, uuid) to service_role;

commit;
