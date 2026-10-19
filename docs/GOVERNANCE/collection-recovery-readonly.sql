-- collection-recovery-readonly.sql
-- READ-ONLY. Run in the Supabase SQL Editor (one statement at a time). Nothing here changes a row.

-- 1. Failed items, with everything needed to decide whether a retry is safe (see COLLECTION-RECOVERY-2026-10-18.md)
select i.id as item_id, i.portfolio_id, p.series, p.status as portfolio_status, p.delivery, i.slot, i.preset, i.status as item_status, i.attempts, i.error,
       i.preview_id, i.rendering_started_at, p.created_at,
       (i.preview_id is not null) as already_has_artwork,
       case when i.preview_id is not null then 'DO NOT RETRY: has artwork'
            when p.status = 'pending' then 'DO NOT RETRY: portfolio not activated'
            when i.error in ('age_restricted', 'unknown_groups_effect', 'unknown_pets_effect') then 'DO NOT RETRY: cannot or must not succeed'
            when i.error in ('generate_failed', 'locked_preview_failed', 'locked_preview_upload_failed', 'ledger_write_failed', 'render_failed', 'unhandled_error') then 'candidate: transient error, no artwork'
            else 'review by hand' end as verdict
from portfolio_items i
join portfolios p on p.id = i.portfolio_id
where i.status = 'failed'
order by p.created_at desc, i.slot;

-- 2. Items stranded mid-render (a claim older than ten minutes: the cron poller will reclaim these on Production)
select i.id as item_id, i.portfolio_id, i.status, i.attempts, i.rendering_started_at, now() - i.rendering_started_at as held_for
from portfolio_items i
where i.status = 'rendering' and i.rendering_started_at < now() - interval '10 minutes'
order by i.rendering_started_at;

-- 3. Paid purchases whose portfolio is still 'pending' (the webhook never activated them). Activating starts paid generation: approve ids first.
select p.id as portfolio_id, p.series, p.status as portfolio_status, p.created_at, pu.id as purchase_id, pu.status as purchase_status, pu.paid_at,
       (select count(*) from portfolio_items i where i.portfolio_id = p.id) as items
from portfolios p
join purchases pu on pu.id = p.purchase_id
where p.status = 'pending' and pu.status = 'paid'
order by p.created_at desc;

-- 4. Counts by state, for a quick picture of the Collection
select p.status as portfolio_status, i.status as item_status, count(*) from portfolio_items i join portfolios p on p.id = i.portfolio_id group by 1, 2 order by 1, 2;
