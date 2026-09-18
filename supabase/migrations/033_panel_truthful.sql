-- 033_panel_truthful.sql
-- Liten & Co — Admin Phase 1: truthful instruments.
--
-- NOT DATABASE-VERIFIED. Written and reviewed statically; never executed.
-- No authorized test database exists for this lane yet, so nothing here has
-- been run against Postgres. Apply to a test project and check the seven
-- payloads before this reaches production.
--
-- Replaces the arithmetic of five of the seven panel functions from 017.
-- Field NAMES are unchanged wherever a definition was corrected, so the panel
-- renders against either version; only genuinely new fields are additive, and
-- the client treats those as optional.
--
-- Rich's rulings, 2026-09-18:
--
--   Craft            a successful customer craft. qa_log.status = 'passed' is
--                    the faithful representation: an image was produced AND it
--                    cleared the fidelity and aesthetic gates. 'failed' means
--                    an image was produced and refused, so it is an attempt,
--                    not a craft. Attempts stay available separately.
--   Orders           paid orders. A row is created before payment, so a bare
--                    count was counting abandoned checkouts as commerce.
--   Paid/not printed paid_at IS NOT NULL AND status = 'error'. The copy has
--                    always asserted the customer was charged; now the query
--                    does too.
--   Render errors    distinct from quality failures. Never folded together.
--   First pass       only where a render was actually attempted. Intake
--                    rejection must not move engine performance.
--   Customer stats   computed across the whole population, never limited by
--                    the 200-row table the UI shows.
--   Credits          purchased and promotional are not the same obligation,
--                    but the balance cannot be truthfully allocated between
--                    them, so only what the ledger records is reported.
--   Revenue          truthfully qualified for what it actually contains.
--
-- WHY status IN ('passed','failed','errored') IS THE "RENDER ATTEMPTED" TEST:
-- qa_log.attempts looked like the natural predicate, but lib/shared/qa-log.ts
-- writes `attempts: out.attempts ?? null` and the catch-path finish in
-- portraits/generate omits it, so a genuine render can land with attempts
-- NULL. Status is written on every path. The three post-render statuses are
-- exactly the rows where the generator ran.

begin;

-- ── OVERVIEW ────────────────────────────────────────────────
create or replace function public.panel_overview(days int default 7)
returns jsonb language sql stable as $$
with
  span as (select (now() - make_interval(days => days)) as since,
                  (now() - make_interval(days => days * 2)) as prior),
  rev as (
    select
      coalesce(sum(amount_cents) filter (where paid_at >= (select since from span)),0) as now_c,
      coalesce(sum(amount_cents) filter (where paid_at >= (select prior from span)
                                           and paid_at <  (select since from span)),0) as prior_c
    from public.purchases where status = 'paid'
  ),
  prev as (
    select
      coalesce(sum(retail_total_cents) filter (where paid_at >= (select since from span)),0) as now_c,
      coalesce(sum(retail_total_cents) filter (where paid_at >= (select prior from span)
                                                 and paid_at <  (select since from span)),0) as prior_c,
      count(*) filter (where paid_at >= (select since from span)) as now_n,
      count(*) filter (where paid_at >= (select prior from span)
                         and paid_at <  (select since from span)) as prior_n
    from public.print_orders where paid_at is not null
  ),
  -- A CRAFT IS A SUCCESSFUL CRAFT. Was: count(*) over qa_log with no filter,
  -- which counted turned-away photos, redirects, generator errors and rows
  -- that never finished as though each were a crafted image.
  crafts as (
    select
      count(*) filter (where status = 'passed'
                         and created_at >= (select since from span)) as now_n,
      count(*) filter (where status = 'passed'
                         and created_at >= (select prior from span)
                         and created_at <  (select since from span)) as prior_n,
      count(*) filter (where created_at >= (select since from span)) as attempts_now
    from public.qa_log
  ),
  cust as (
    select
      count(*) filter (where first_seen >= (select since from span)) as now_n,
      count(*) filter (where first_seen >= (select prior from span)
                         and first_seen <  (select since from span)) as prior_n
    from public.identity_map
  ),
  held as (select coalesce(sum(balance),0) as credits from public.credit_balances),
  -- PAID, NOT PRINTED. Was: status = 'error' alone, so an order that failed
  -- before payment was reported as a charged customer waiting on a print.
  errs as (
    select count(*) n, min(created_at) oldest
    from public.print_orders
    where status = 'error' and paid_at is not null
  ),
  funnel as (
    select
      count(*) filter (where name = 'session_start')     as visited,
      count(*) filter (where name = 'series_view')       as series,
      count(*) filter (where name = 'upload_complete')   as uploaded,
      count(*) filter (where name = 'effect_add')        as chose,
      count(*) filter (where name = 'checkout_open')     as checkout,
      count(*) filter (where name = 'purchase_complete') as paid
    from public.events
    where created_at >= (select since from span)
  )
select jsonb_build_object(
  'days', days,
  'revenue_cents',       (select now_c from rev) + (select now_c from prev),
  'revenue_prior_cents', (select prior_c from rev) + (select prior_c from prev),
  'crafts',              (select now_n from crafts),
  'crafts_prior',        (select prior_n from crafts),
  'craft_attempts',      (select attempts_now from crafts),
  'prints',              (select now_n from prev),
  'prints_prior',        (select prior_n from prev),
  'customers',           (select now_n from cust),
  'customers_prior',     (select prior_n from cust),
  'credits_held',        (select credits from held),
  'orders_in_error',     (select n from errs),
  'orders_in_error_oldest', (select oldest from errs),
  'funnel', (select to_jsonb(funnel) from funnel)
)
$$;

-- ── ENGINE ──────────────────────────────────────────────────
create or replace function public.panel_engine(days int default 30)
returns jsonb language sql stable as $$
with
  span as (select (now() - make_interval(days => days)) as since),
  tot as (
    select count(*) all_time,
           count(*) filter (where created_at >= (select since from span)) recent,
           count(*) filter (where first_pass) firsts,
           count(*) filter (where status = 'passed')          passed,
           count(*) filter (where status = 'failed')          failed,
           count(*) filter (where status = 'errored')         errored,
           count(*) filter (where status = 'in_progress')     in_progress,
           count(*) filter (where status = 'intake_rejected') rejected,
           count(*) filter (where status = 'redirected')      redirected,
           -- FIRST-PASS DENOMINATOR. Was: all_time, every row including
           -- turned-away photos and redirects, so raising intake strictness
           -- dragged the engine's score down without the engine changing.
           count(*) filter (where status in ('passed','failed','errored')) attempted,
           coalesce(sum(cost_cents),0) cost
    from public.qa_log
  ),
  kept as (select count(*) n from public.collection_pieces where archived = false),
  by_finish as (
    select coalesce(preset_id,'—') as finish,
           count(*) crafted,
           round(100.0 * count(*) filter (where first_pass)
                 / nullif(count(*) filter (where status in ('passed','failed','errored')),0)) first_pct,
           round(avg(attempts)::numeric, 1) avg_attempts,
           round(avg(fidelity_score) filter (where fidelity_score is not null), 1) likeness,
           round(coalesce(sum(cost_cents),0)::numeric / nullif(count(*),0) / 100.0, 2) cost_each
    from public.qa_log
    where created_at >= (select since from span)
    group by 1
    order by 2 desc
    limit 12
  )
select jsonb_build_object(
  'days', days,
  'renders_all_time', (select all_time from tot),
  'renders_recent',   (select recent from tot),
  'first_pass_pct',   (select round(100.0 * firsts / nullif(attempted,0)) from tot),
  'kept_pieces',      (select n from kept),
  -- Cost is measured per PASSED render. qa_log counts every render the engine
  -- ran and collection_pieces holds only kept customer pieces, so dividing
  -- one by the other compares two different populations and reads far too
  -- high. Both figures below are estimates: they derive from the QA_COST
  -- table in portraits/generate, which that file marks "observability only —
  -- not billing". The panel labels them Est. accordingly.
  'cost_total_cents', (select cost from tot),
  'cost_per_render',  (select round((select cost from tot)::numeric / nullif((select all_time from tot),0) / 100.0, 3)),
  'cost_per_passed',  (select round((select cost from tot)::numeric / nullif((select passed from tot),0) / 100.0, 2)),
  'attributed',       (select count(*) from public.qa_log where render_ref is not null),
  -- WHERE RENDERS END, reconciling. errored and in_progress were counted in
  -- renders_all_time but appeared in no bucket, so the bars silently omitted
  -- every hard generator failure and the four of them never summed to the
  -- total. A system error is not a quality refusal and keeps its own bar.
  'outcomes', jsonb_build_object(
      'passed',      (select passed from tot),
      'failed',      (select failed from tot),
      'errored',     (select errored from tot),
      'rejected',    (select rejected from tot),
      'redirected',  (select redirected from tot),
      'in_progress', (select in_progress from tot)),
  'by_finish', coalesce((select jsonb_agg(to_jsonb(by_finish)) from by_finish), '[]'::jsonb)
)
$$;

-- ── CUSTOMERS ───────────────────────────────────────────────
create or replace function public.panel_customers()
returns jsonb language sql stable as $$
with
  -- HEADLINE STATS OVER THE WHOLE POPULATION. Was: computed from the same
  -- 200-row CTE that feeds the table, so past 200 customers the three summary
  -- cards silently described only the most recent 200 while sitting beside a
  -- whole-table total.
  everyone as (
    select
      m.owner_key,
      m.user_id,
      (select count(*) from public.collection_pieces p
        where p.owner_key = m.owner_key and p.archived = false) pieces,
      (select count(*) from public.purchases pu
        where pu.user_id = m.user_id and pu.status = 'paid') purchases
    from public.identity_map m
  ),
  people as (
    select m.owner_key, m.email, m.first_seen,
           coalesce(cb.balance,0) credits,
           (select count(*) from public.collection_pieces p
             where p.owner_key = m.owner_key and p.archived = false) pieces,
           (select count(*) from public.print_orders o
             where o.owner_key = m.owner_key and o.paid_at is not null) prints,
           (select coalesce(sum(amount_cents),0) from public.purchases pu
             where pu.user_id = m.user_id and pu.status = 'paid') spent_cents,
           (select count(*) from public.purchases pu
             where pu.user_id = m.user_id and pu.status = 'paid') purchases
    from public.identity_map m
    left join public.credit_balances cb on cb.owner_key = m.owner_key
    order by m.first_seen desc
    limit 200
  ),
  -- LIFETIME LEDGER TOTALS, NOT AN ALLOCATION. credit_balances holds one net
  -- integer per owner and credit_ledger records no consumption order, so which
  -- credits a spend drew down is unknowable. Reporting an "unused purchased"
  -- figure would be invented accounting; these say only what was recorded.
  ledger as (
    select
      coalesce(sum(delta) filter (where delta > 0 and reason = 'purchase'),0) purchased,
      coalesce(sum(delta) filter (where delta > 0
                                    and reason in ('code','grant','referral')),0) granted
    from public.credit_ledger
  )
select jsonb_build_object(
  'total',        (select count(*) from public.identity_map),
  'crafted_only', (select count(*) from everyone where pieces > 0 and purchases = 0),
  'repeat',       (select count(*) from everyone where purchases > 1),
  'credits_held', (select coalesce(sum(balance),0) from public.credit_balances),
  'credits_purchased_ever', (select purchased from ledger),
  'credits_granted_ever',   (select granted from ledger),
  -- The most recent identity the map knows about. The 014 backfill seeded
  -- first_seen from real source-table timestamps, so this is a genuine
  -- coverage date and not the date the backfill ran.
  'last_known',   (select max(first_seen) from public.identity_map),
  'people',       coalesce((select jsonb_agg(to_jsonb(people)) from people), '[]'::jsonb)
)
$$;

-- ── FULFILMENT ──────────────────────────────────────────────
create or replace function public.panel_fulfilment()
returns jsonb language sql stable as $$
with
  totals as (
    select
      -- ORDERS MEANS PAID ORDERS. Was: a bare count(*), and print_orders
      -- defaults to 'created' before payment, so abandoned checkouts were
      -- reported as commerce next to a revenue figure that excluded them.
      count(*) filter (where paid_at is not null) orders,
      count(*) filter (where status = 'error' and paid_at is not null) in_error,
      coalesce(sum(retail_total_cents) filter (where paid_at is not null),0) retail,
      coalesce(sum(wholesale_cost_cents) filter (where paid_at is not null),0) wholesale,
      count(*) filter (where wholesale_cost_cents is not null
                         and paid_at is not null) wholesale_known
    from public.print_orders
  ),
  recent as (
    select id, status, created_at, customer_email, owner_key,
           retail_total_cents, prodigi_order_id, tracking_url, error_message, items
    from public.print_orders order by created_at desc limit 40
  )
select jsonb_build_object(
  'orders',    (select orders from totals),
  'in_error',  (select in_error from totals),
  'retail_cents',    (select retail from totals),
  'wholesale_cents', (select wholesale from totals),
  -- MARGIN IS NULL UNTIL A LAB COST EXISTS. Was: (retail - 0) / retail, which
  -- is 100 for any revenue at all. wholesale_cost_cents is never written —
  -- print/webhook passes wholesaleCents: null — so the old figure was not a
  -- thin margin or a stale margin, it was arithmetic on a column that has no
  -- data. A null here renders as unavailable rather than as perfect profit.
  'margin_pct', (select case when wholesale_known > 0 and retail > 0
                             then round(100.0 * (retail - wholesale) / retail)
                        end from totals),
  'recent', coalesce((select jsonb_agg(to_jsonb(recent)) from recent), '[]'::jsonb)
)
$$;

-- ── HEALTH ──────────────────────────────────────────────────
create or replace function public.panel_health(days int default 7)
returns jsonb language sql stable as $$
with
  span as (select (now() - make_interval(days => days)) as since),
  t as (select duration_ms from public.qa_log
        where duration_ms is not null and created_at >= (select since from span)),
  hourly as (
    select extract(hour from created_at)::int as "hour",
           round(avg(duration_ms)/1000.0, 1) avg_s,
           count(*) n,
           count(*) filter (where status in ('failed','errored')) fails
    from public.qa_log
    where duration_ms is not null and created_at >= (select since from span)
    group by 1 order by 1
  ),
  inc as (
    select incident_id, severity, surface, component, summary,
           "count", first_seen, last_seen, status
    from public.error_log where status in ('open','ack')
    order by last_seen desc limit 25
  )
select jsonb_build_object(
  'days', days,
  'median_ms', (select percentile_cont(0.5) within group (order by duration_ms) from t),
  'p95_ms',    (select percentile_cont(0.95) within group (order by duration_ms) from t),
  -- Failure rate over rows where a render was attempted, matching the Engine
  -- tab. Was: divided by every row in the window, so turned-away photos and
  -- rows still running dragged the rate down and a route that crashed before
  -- finishing made the engine look healthier.
  'failure_pct', (select round(100.0 * count(*) filter (where status in ('failed','errored'))
                               / nullif(count(*) filter (where status in ('passed','failed','errored')),0), 1)
                  from public.qa_log where created_at >= (select since from span)),
  'open_incidents', (select count(*) from public.error_log where status = 'open'),
  'hourly',    coalesce((select jsonb_agg(to_jsonb(hourly)) from hourly), '[]'::jsonb),
  'incidents', coalesce((select jsonb_agg(to_jsonb(inc)) from inc), '[]'::jsonb)
)
$$;

grant execute on function
  public.panel_overview(int), public.panel_engine(int),
  public.panel_customers(), public.panel_fulfilment(), public.panel_health(int)
to service_role;

commit;
