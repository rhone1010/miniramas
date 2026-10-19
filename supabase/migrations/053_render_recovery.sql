-- 053_render_recovery.sql
--
-- Bounded AUTOMATIC RECOVERY of a Discovery render that failed for a transient reason. NOT APPLIED. Independent of 047 to 052.
--
-- Today a render that fails three times becomes 'failed' and nothing ever touches it again. This adds ONE more cycle, later, under hard limits that the DATABASE
-- enforces in one transaction (so two cron ticks, two servers or an operator and a cron cannot both recover the same item or overspend):
--     eligible      status 'failed', no preview_id (no artwork exists, so nothing can be duplicated), recovery_count 0, failed at least p_backoff ago,
--                   a recorded failure time (so every failure that predates this migration is NEVER recovered), a PAID purchase and an activated portfolio
--                   ('generating' or 'ready'; never 'pending' or 'failed'), and a transient error (an allow-list passed in by the caller)
--     spend         each recovery reserves p_cost_usd in render_recovery_ledger; the sum for the UTC day may not pass p_daily_cap_usd
--     effect        the item goes back to 'pending' with attempts 0 (one new cycle), recovery_count 1, recovered_at now; a 'ready' portfolio goes back to 'generating'
--                   so the ordinary dispatch/poller picks the item up. A second failure is final: recovery_count stays 1.
-- Additive and idempotent. Changes no existing function or row. Service role only.

alter table public.portfolio_items
  add column if not exists failed_at timestamptz,                      -- set when the item becomes 'failed' (code); null for every earlier failure
  add column if not exists recovery_count int not null default 0,      -- automatic recovery cycles used
  add column if not exists recovered_at timestamptz;                   -- when the last cycle was started

create index if not exists idx_portfolio_items_failed_recovery on public.portfolio_items (failed_at) where status = 'failed';

-- The spend ledger: every recovery reserves its worst-case cost here, before anything is generated. Kept when an item is deleted (no foreign key): it is accounting.
create table if not exists public.render_recovery_ledger (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null,
  portfolio_id   uuid,
  day            date not null default ((now() at time zone 'utc')::date),
  reserved_usd   numeric(10, 4) not null check (reserved_usd >= 0),
  previous_error text,
  created_at     timestamptz not null default now()
);
create index if not exists render_recovery_ledger_day_idx on public.render_recovery_ledger (day);
alter table public.render_recovery_ledger enable row level security;

-- Atomically claim ONE recovery. Returns (claimed, reason); when claimed is true the item is already 'pending' again.
create or replace function public.claim_render_recovery(
  p_item uuid, p_cost_usd numeric, p_daily_cap_usd numeric, p_backoff_seconds int, p_max_recoveries int,
  p_transient text[], p_transient_pattern text
) returns table (claimed boolean, reason text)
language plpgsql security definer set search_path = public as $$
declare i public.portfolio_items; p public.portfolios; pu_status text; spent numeric; today date := (now() at time zone 'utc')::date;
begin
  if p_cost_usd is null or p_cost_usd <= 0 or p_daily_cap_usd is null or p_daily_cap_usd <= 0 then return query select false, 'accounting_not_configured'; return; end if;
  -- One writer at a time for the day's spend, then the item row itself: a concurrent claim waits here and then sees the item already 'pending'.
  perform pg_advisory_xact_lock(hashtextextended('render_recovery_spend', 0));
  select * into i from public.portfolio_items where id = p_item for update;
  if not found then return query select false, 'item_not_found'; return; end if;
  if i.status <> 'failed' then return query select false, 'not_failed'; return; end if;
  if i.preview_id is not null then return query select false, 'has_artwork'; return; end if;
  if i.recovery_count >= p_max_recoveries then return query select false, 'already_recovered'; return; end if;
  if i.failed_at is null then return query select false, 'no_failure_time'; return; end if;
  if i.failed_at > now() - make_interval(secs => p_backoff_seconds) then return query select false, 'backoff'; return; end if;
  select * into p from public.portfolios where id = i.portfolio_id for update;
  if not found or p.status not in ('generating', 'ready') then return query select false, 'portfolio_not_active'; return; end if;
  select status::text into pu_status from public.purchases where id = p.purchase_id;
  if p.purchase_id is null or pu_status is distinct from 'paid' then return query select false, 'not_paid'; return; end if;
  if i.error is null or not (i.error = any (p_transient) or (p_transient_pattern is not null and i.error ~* p_transient_pattern)) then return query select false, 'permanent_error'; return; end if;
  select coalesce(sum(reserved_usd), 0) into spent from public.render_recovery_ledger where day = today;
  if spent + p_cost_usd > p_daily_cap_usd then return query select false, 'daily_ceiling'; return; end if;

  insert into public.render_recovery_ledger(item_id, portfolio_id, day, reserved_usd, previous_error) values (i.id, i.portfolio_id, today, p_cost_usd, i.error);
  update public.portfolio_items set status = 'pending', attempts = 0, error = null, rendering_started_at = null, recovery_count = recovery_count + 1, recovered_at = now() where id = i.id;
  update public.portfolios set status = 'generating' where id = p.id and status = 'ready';
  return query select true, 'claimed';
end $$;

revoke all on function public.claim_render_recovery(uuid, numeric, numeric, int, int, text[], text) from public, anon, authenticated;
revoke all on public.render_recovery_ledger from anon, authenticated;
grant execute on function public.claim_render_recovery(uuid, numeric, numeric, int, int, text[], text) to service_role;
grant select, insert, update, delete on public.render_recovery_ledger to service_role;
