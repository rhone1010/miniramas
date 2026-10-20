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
