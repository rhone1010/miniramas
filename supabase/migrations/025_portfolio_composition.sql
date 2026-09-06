-- 025_portfolio_composition.sql
-- One pose, one shape, one subject — for the whole portfolio.
--
-- portraits.html sends a full composition block with every craft
-- (portraits.html:6807-6824: location, scale, aspect_ratio, resolution,
-- pose, focal). Discovery collected a pose and a shape in the UI and then
-- dropped both: createPortfolioCheckout persisted only preset and
-- source_image, and portfolios/items/render hardcoded framing='bust',
-- scale='close_up' for every piece in every portfolio ever bought.
--
-- Ruled 2026-09-06: ONE pose for the whole purchase, not per slot. So this
-- is a column on portfolios, not on portfolio_items — a per-slot column
-- would invite a per-slot pose that the product does not offer.
--
-- jsonb, not six columns: the block travels as a unit from the browser to
-- /portraits/generate and nothing in between reads a single field of it.
-- Fields Discovery does not collect (location, resolution, focal) are
-- simply absent, and the generate route applies its own documented
-- defaults for them — the same as portraits sending them undefined.
--
-- Additive and defaulted, so the write path works before and after this
-- lands and no existing row needs backfilling. An old portfolio has {} and
-- renders exactly as it does today.

alter table portfolios
  add column if not exists composition jsonb not null default '{}'::jsonb;

comment on column portfolios.composition is
  'Composition block for every item in this portfolio: pose, aspect_ratio, subject, framing. One per purchase, never per slot.';
