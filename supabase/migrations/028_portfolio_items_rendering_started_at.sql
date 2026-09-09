-- 028_portfolio_items_rendering_started_at.sql
--
-- When a render invocation claimed this item.
--
-- An item is claimed by flipping status 'pending' -> 'rendering'. If the
-- invocation holding it is killed -- a timeout, a deploy mid-flight, a cold
-- start that never completes -- the row stays 'rendering' forever. Nothing
-- reclaims it: the poller selects 'pending' only, so a paid image can be
-- stranded permanently with no error and no retry.
--
-- Reclaiming needs to know HOW LONG the row has been held, and the table
-- carries no timestamp that can answer that. created_at is insert time, set
-- at checkout, and says nothing about the claim. So this is stamped at claim
-- and cleared when the item leaves 'rendering'.
--
-- Nullable with no default on purpose: a row that is not 'rendering' has no
-- claim time, and NULL says exactly that. Backfill would be a lie.
--
-- Only meaningful while status = 'rendering'. It is not cleared on the way
-- out -- the reclaim predicate already requires that status, so a stale
-- stamp on a finished row can never select it, and clearing it would cost a
-- second write on every item for no reader.
--
-- Deliberately its own column rather than a value smuggled into `error` or
-- `job_id`. Those mean other things, and overloading a field that means
-- something else is the mistake preview_ledger.email already made.

alter table portfolio_items
  add column if not exists rendering_started_at timestamptz;

comment on column portfolio_items.rendering_started_at is
  'Set when status flips to rendering. Meaningful only while status is rendering, and read only to reclaim rows whose claiming invocation died.';

-- The reclaim scan is status + age.
create index if not exists idx_portfolio_items_rendering_started
  on portfolio_items (status, rendering_started_at);
