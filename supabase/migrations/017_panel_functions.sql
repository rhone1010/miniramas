-- 017_panel_functions.sql
-- Liten & Co — reporting functions for the control panel.
--
-- The panel calls these instead of assembling numbers in JavaScript. One
-- round trip per tab, the arithmetic happens where the data lives, and the
-- definition of "revenue" or "a kept piece" exists in exactly one place.
--
-- Every function is read-only. Nothing here writes.

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
  crafts as (
    select
      count(*) filter (where created_at >= (select since from span)) as now_n,
      count(*) filter (where created_at >= (select prior from span)
                         and created_at <  (select since from span)) as prior_n
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
  errs as (select count(*) n, min(created_at) oldest from public.print_orders where status = 'error'),
  funnel as (
    select
      count(*) filter (where name = 'session_start')   as visited,
      count(*) filter (where name = 'series_view')     as series,
      count(*) filter (where name = 'upload_complete') as uploaded,
      count(*) filter (where name = 'effect_add')      as chose,
      count(*) filter (where name = 'checkout_open')   as checkout,
      count(*) filter (where name = 'purchase_complete') as paid
    from public.events where created_at >= (select since from span)
  )
select jsonb_build_object(
  'days', days,
  'revenue_cents',       (select now_c from rev) + (select now_c from prev),
  'revenue_prior_cents', (select prior_c from rev) + (select prior_c from prev),
  'crafts',        (select now_n from crafts),
  'crafts_prior',  (select prior_n from crafts),
  'prints',        (select now_n from prev),
  'prints_prior',  (select prior_n from prev),
  'customers',       (select now_n from cust),
  'customers_prior', (select prior_n from cust),
  'credits_held',  (select credits from held),
  'orders_in_error',        (select n from errs),
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
           count(*) filter (where status = 'intake_rejected') rejected,
           count(*) filter (where status = 'redirected')      redirected,
           coalesce(sum(cost_cents),0) cost
    from public.qa_log
  ),
  kept as (select count(*) n from public.collection_pieces where archived = false),
  by_finish as (
    select coalesce(preset_id,'—') as finish,
           count(*) crafted,
           round(100.0 * count(*) filter (where first_pass) / nullif(count(*),0)) first_pct,
           round(avg(attempts)::numeric, 1) avg_attempts,
           round(avg(fidelity_score) filter (where fidelity_score is not null), 1) likeness,
           round(coalesce(sum(cost_cents),0)::numeric / nullif(count(*),0) / 100.0, 2) cost_each
    from public.qa_log
    where created_at >= (select since from span)
    group by 1 order by 2 desc limit 12
  )
select jsonb_build_object(
  'days', days,
  'renders_all_time', (select all_time from tot),
  'renders_recent',   (select recent from tot),
  'first_pass_pct',   (select round(100.0 * firsts / nullif(all_time,0)) from tot),
  'kept_pieces',      (select n from kept),
  -- Cost is measured per PASSED render. qa_log counts bench runs as well as
  -- customer crafts, and collection_pieces holds only the latter, so dividing
  -- one by the other compares two different populations and reads far too
  -- high. When qa_log carries render_ref and user_ref, a true per-piece
  -- figure becomes possible; until then this is the honest number.
  'cost_total_cents', (select cost from tot),
  'cost_per_render',  (select round((select cost from tot)::numeric / nullif((select all_time from tot),0) / 100.0, 3)),
  'cost_per_passed',  (select round((select cost from tot)::numeric / nullif((select passed from tot),0) / 100.0, 2)),
  'attributed',       (select count(*) from public.qa_log where render_ref is not null),
  'outcomes', jsonb_build_object(
      'passed',     (select passed from tot),
      'failed',     (select failed from tot),
      'rejected',   (select rejected from tot),
      'redirected', (select redirected from tot)),
  'by_finish', coalesce((select jsonb_agg(to_jsonb(by_finish)) from by_finish), '[]'::jsonb)
)
$$;

-- ── MARKETING ───────────────────────────────────────────────
create or replace function public.panel_marketing(days int default 7)
returns jsonb language sql stable as $$
with
  span as (select (now() - make_interval(days => days)) as since),
  e as (select * from public.events where created_at >= (select since from span)),
  headline as (
    select count(*) filter (where name = 'session_start')   visits,
           count(distinct anon_id) people,
           count(*) filter (where name = 'series_view')     series_views,
           count(*) filter (where name = 'printshop_open')  printshop,
           count(*) filter (where name = 'print_checkout_open') print_checkout
    from e
  ),
  sources as (
    select coalesce(nullif(utm->>'utm_source',''),'Direct') source,
           count(*) filter (where name = 'session_start') visits,
           count(*) filter (where name = 'purchase_complete') paid
    from e group by 1 order by 2 desc limit 10
  ),
  campaigns as (
    select coalesce(nullif(utm->>'utm_content',''),'—') content,
           coalesce(nullif(utm->>'utm_campaign',''),'—') campaign,
           count(*) filter (where name = 'session_start') visits,
           count(*) filter (where name = 'purchase_complete') paid
    from e where utm is not null group by 1,2 order by 3 desc limit 10
  ),
  rooms as (
    select coalesce(series,'—') room, count(*) n
    from e where name = 'series_view' group by 1 order by 2 desc limit 8
  ),
  pages as (
    select coalesce(props->>'target','—') target, count(*) n
    from e where name = 'nav_click' group by 1 order by 2 desc limit 8
  )
select jsonb_build_object(
  'days', days,
  'headline',  (select to_jsonb(headline) from headline),
  'sources',   coalesce((select jsonb_agg(to_jsonb(sources))   from sources),   '[]'::jsonb),
  'campaigns', coalesce((select jsonb_agg(to_jsonb(campaigns)) from campaigns), '[]'::jsonb),
  'rooms',     coalesce((select jsonb_agg(to_jsonb(rooms))     from rooms),     '[]'::jsonb),
  'pages',     coalesce((select jsonb_agg(to_jsonb(pages))     from pages),     '[]'::jsonb)
)
$$;

-- ── CUSTOMERS ───────────────────────────────────────────────
create or replace function public.panel_customers()
returns jsonb language sql stable as $$
with
  people as (
    select m.owner_key, m.email, m.first_seen, m.utm_source,
           coalesce(cb.balance,0) credits,
           (select count(*) from public.collection_pieces p
             where p.owner_key = m.owner_key and p.archived = false) pieces,
           (select count(*) from public.print_orders o
             where o.owner_key = m.owner_key and o.paid_at is not null) prints,
           (select coalesce(sum(amount_cents),0) from public.purchases pu
             where pu.user_id = m.user_id and pu.status = 'paid') spent_cents,
           (select count(*) from public.purchases pu
             where pu.user_id = m.user_id and pu.status = 'paid') purchases
    from (select im.*, null::text as utm_source from public.identity_map im) m
    left join public.credit_balances cb on cb.owner_key = m.owner_key
    order by m.first_seen desc
    limit 200
  )
select jsonb_build_object(
  'total',        (select count(*) from public.identity_map),
  'crafted_only', (select count(*) from people where pieces > 0 and purchases = 0),
  'repeat',       (select count(*) from people where purchases > 1),
  'credits_held', (select coalesce(sum(balance),0) from public.credit_balances),
  'people',       coalesce((select jsonb_agg(to_jsonb(people)) from people), '[]'::jsonb)
)
$$;

-- ── FULFILMENT ──────────────────────────────────────────────
create or replace function public.panel_fulfilment()
returns jsonb language sql stable as $$
with
  totals as (
    select count(*) orders,
           count(*) filter (where status = 'error') in_error,
           coalesce(sum(retail_total_cents)   filter (where paid_at is not null),0) retail,
           coalesce(sum(wholesale_cost_cents) filter (where paid_at is not null),0) wholesale
    from public.print_orders
  ),
  recent as (
    select id, status::text, created_at, customer_email, owner_key,
           retail_total_cents, prodigi_order_id, tracking_url, error_message, items
    from public.print_orders order by created_at desc limit 40
  )
select jsonb_build_object(
  'orders',    (select orders from totals),
  'in_error',  (select in_error from totals),
  'retail_cents',    (select retail from totals),
  'wholesale_cents', (select wholesale from totals),
  'margin_pct', (select case when retail > 0
                        then round(100.0 * (retail - wholesale) / retail) end from totals),
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
  'failure_pct', (select round(100.0 * count(*) filter (where status in ('failed','errored'))
                               / nullif(count(*),0), 1)
                  from public.qa_log where created_at >= (select since from span)),
  'open_incidents', (select count(*) from public.error_log where status = 'open'),
  'hourly',    coalesce((select jsonb_agg(to_jsonb(hourly)) from hourly), '[]'::jsonb),
  'incidents', coalesce((select jsonb_agg(to_jsonb(inc)) from inc), '[]'::jsonb)
)
$$;

-- ── CONTROLS ────────────────────────────────────────────────
create or replace function public.panel_controls()
returns jsonb language sql stable as $$
select jsonb_build_object(
  'qa_settings', coalesce((select jsonb_agg(to_jsonb(q)) from
                    (select series, source_strictness, render_strictness, qa_enabled, updated_at
                     from public.qa_settings order by series) q), '[]'::jsonb),
  'flags', coalesce((select jsonb_agg(to_jsonb(f)) from
                    (select owner_key, fulfilment, note, updated_at
                     from public.account_flags order by owner_key) f), '[]'::jsonb),
  'prompts', coalesce((select jsonb_agg(to_jsonb(p)) from
                    (select engine_id, created_at, score, iterations
                     from public.prompt_versions where is_active
                     order by engine_id) p), '[]'::jsonb)
)
$$;

grant execute on function
  public.panel_overview(int), public.panel_engine(int), public.panel_marketing(int),
  public.panel_customers(), public.panel_fulfilment(), public.panel_health(int),
  public.panel_controls()
to service_role;

commit;
