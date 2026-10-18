-- 052_gift_composition_repair.sql
--
-- Gift Wizard: OPERATOR REPAIR of a composition whose stored file fails the frozen-product shape check. NOT APPLIED. Requires 048 and 049.
--
-- A repair stores a replacement composition beside the defective one it supersedes, with the SAME attempt number, so the customer's included
-- correction (attempt 2, gift_order_lines.corrections_used) is never consumed. gift_compositions was unique on (session, line, preview, attempt)
-- and attempt is limited to 1 or 2, so that second row needs its own dimension: repair_seq (0 for every existing and ordinary row).
--
--   gift_compositions.repair_seq   0 = an ordinary composition; 1, 2, ... = the nth repair replacement of that attempt. Unique together with
--                                  (session, line, preview, attempt). No existing row changes. The attempt check (1 or 2) is unchanged.
--   gift_repair_claims             at most ONE live claim per (session, line): the database-atomic guard against two serverless processes
--                                  starting the same paid generation. A claim expires (default 15 minutes) so a crashed process cannot block a line forever.
--   gift_claim_repair              take the claim: returns its token, or null when someone else holds an unexpired one. Atomic (one row, one conflict target).
--   gift_release_repair            drop a claim you hold (a failed attempt); a wrong token does nothing.
--   gift_complete_repair           in ONE transaction: check the claim token, check the order still awaits approval, supersede the old composition (history
--                                  kept, reason recorded) and drop the claim. Refuses once the order is approved or released.
-- Additive and idempotent. Changes no existing function, row or permission. Service role only.

alter table public.gift_compositions add column if not exists repair_seq int not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.gift_compositions'::regclass and conname = 'gift_compositions_repair_seq_check') then
    alter table public.gift_compositions add constraint gift_compositions_repair_seq_check check (repair_seq >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.gift_compositions'::regclass and conname = 'gift_compositions_line_attempt_repair_key') then
    alter table public.gift_compositions add constraint gift_compositions_line_attempt_repair_key unique (session_id, line_id, preview_id, attempt, repair_seq);
  end if;
  -- the old key is a strict subset of the new one for every existing row (repair_seq = 0), so dropping it loses no protection for ordinary rows
  -- (the new key still refuses a second ordinary row, because both would have repair_seq = 0).
  alter table public.gift_compositions drop constraint if exists gift_compositions_session_id_line_id_preview_id_attempt_key;
end $$;

create table if not exists public.gift_repair_claims (
  session_id     uuid not null references public.gift_sessions(id) on delete cascade,
  line_id        text not null,
  composition_id uuid not null references public.gift_compositions(id) on delete cascade,
  token          uuid not null default gen_random_uuid(),
  operator       text not null,
  claimed_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  primary key (session_id, line_id)
);
alter table public.gift_repair_claims enable row level security;

create or replace function public.gift_claim_repair(p_session uuid, p_line text, p_composition uuid, p_operator text, p_ttl_seconds int default 900)
returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if coalesce(btrim(p_operator), '') = '' then raise exception 'operator_required'; end if;
  if not exists (select 1 from public.gift_compositions c where c.id = p_composition and c.session_id = p_session and c.line_id = p_line and c.status in ('ready', 'approved')) then
    raise exception 'composition_not_found';
  end if;
  -- One statement: either this call inserts the claim, or it takes over an EXPIRED one, or it changes nothing and t stays null.
  insert into public.gift_repair_claims(session_id, line_id, composition_id, operator, expires_at)
    values (p_session, p_line, p_composition, p_operator, now() + make_interval(secs => greatest(30, p_ttl_seconds)))
  on conflict (session_id, line_id) do update
    set composition_id = excluded.composition_id, token = gen_random_uuid(), operator = excluded.operator, claimed_at = now(), expires_at = excluded.expires_at
    where public.gift_repair_claims.expires_at <= now()
  returning token into t;
  return t;
end $$;

create or replace function public.gift_release_repair(p_session uuid, p_line text, p_token uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.gift_repair_claims where session_id = p_session and line_id = p_line and token = p_token;
end $$;

-- Retire the defective composition in favour of the stored replacement, atomically with releasing the claim.
create or replace function public.gift_complete_repair(p_session uuid, p_line text, p_token uuid, p_old uuid, p_new uuid, p_note jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare s public.gift_sessions; ost text; cl public.gift_repair_claims; o public.gift_compositions; n public.gift_compositions;
begin
  select * into s from public.gift_sessions where id = p_session for update;
  if not found then raise exception 'session_not_found'; end if;
  if s.refunded_at is not null then raise exception 'order_refunded'; end if;
  if s.refund_requested_at is not null then raise exception 'refund_pending'; end if;
  if s.order_id is null or s.approved_at is not null then raise exception 'order_not_awaiting_artwork'; end if;
  select status::text into ost from public.print_orders where id = s.order_id for update;
  if ost is distinct from 'awaiting_artwork' then raise exception 'order_not_awaiting_artwork'; end if;

  select * into cl from public.gift_repair_claims where session_id = p_session and line_id = p_line for update;
  if not found or cl.token <> p_token then raise exception 'repair_claim_lost'; end if;

  select * into o from public.gift_compositions where id = p_old and session_id = p_session and line_id = p_line for update;
  select * into n from public.gift_compositions where id = p_new and session_id = p_session and line_id = p_line for update;
  if o.id is null or n.id is null or o.id = n.id or n.repair_seq <= 0 or n.status <> 'ready' or n.preview_id <> o.preview_id or n.attempt <> o.attempt then
    raise exception 'repair_not_consistent';
  end if;
  if o.status in ('ready', 'approved') then
    update public.gift_compositions set status = 'superseded',
      plan = coalesce(o.plan, '{}'::jsonb) || coalesce(p_note, '{}'::jsonb) || jsonb_build_object('supersededReason', 'geometry_defect', 'supersededBy', p_new, 'supersededAt', now())
      where id = p_old;
  end if;
  delete from public.gift_repair_claims where session_id = p_session and line_id = p_line and token = p_token;
end $$;

revoke all on function public.gift_claim_repair(uuid, text, uuid, text, int)               from public, anon, authenticated;
revoke all on function public.gift_release_repair(uuid, text, uuid)                        from public, anon, authenticated;
revoke all on function public.gift_complete_repair(uuid, text, uuid, uuid, uuid, jsonb)    from public, anon, authenticated;
revoke all on public.gift_repair_claims from anon, authenticated;
grant execute on function public.gift_claim_repair(uuid, text, uuid, text, int)            to service_role;
grant execute on function public.gift_release_repair(uuid, text, uuid)                     to service_role;
grant execute on function public.gift_complete_repair(uuid, text, uuid, uuid, uuid, jsonb) to service_role;
grant select, insert, update, delete on public.gift_repair_claims to service_role;
