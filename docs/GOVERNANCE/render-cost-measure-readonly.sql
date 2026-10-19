-- render-cost-measure-readonly.sql
-- READ-ONLY. What one Discovery render actually cost, per series, from qa_log.cost_cents (the application's own per-request accounting, in cents; it is the same
-- model as the constants in the generate routes, so it is a check of how often the worst case happens, not an invoice). Use it to confirm RENDER_RECOVERY_COST_USD.
-- Compare the result with the provider invoices (Replicate/Google for NB2, OpenAI for the gates, Stability for outpaint) for the same days before relying on it.
select series,
       count(*)                                                          as requests,
       round(avg(cost_cents)::numeric, 1)                                as avg_cents,
       percentile_disc(0.95) within group (order by cost_cents)          as p95_cents,
       max(cost_cents)                                                   as max_cents,
       round(avg(attempts)::numeric, 2)                                  as avg_attempts,
       max(attempts)                                                     as max_attempts
from public.qa_log
where created_at > now() - interval '60 days' and cost_cents > 0
group by series order by series;
