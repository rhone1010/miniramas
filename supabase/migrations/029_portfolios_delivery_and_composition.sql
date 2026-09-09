-- 029_portfolios_delivery_and_composition.sql
--
-- Two things a portfolio could not previously say about itself.
--
-- 1 · DELIVERY. Whether its pieces are locked previews bought one unlock at
--     a time, or bought outright at purchase. Nothing in the table expressed
--     this. `size` would have meant testing `size = 1` at every reader, which
--     is the scattered special case this column exists to prevent; `status`
--     is lifecycle (pending/generating/ready), not delivery model; and
--     `free_unlocks` is a QUANTITY, not a KIND -- reading 0 as "owned
--     outright" is exactly the kind of inference we stopped doing.
--
--     Written once, at checkout, from the purchase size table. Read in two
--     places: activation (mint entitlements, or none) and render (stamp
--     preview_ledger.unlocked_at, or leave it null). No reader tests size.
--
--     DEFAULT 'preview' is the whole of the backward compatibility story:
--     every existing row, and every 4/8/16 purchase after this, behaves
--     exactly as it did.
--
-- 2 · COMPOSITION. pose / framing / subject. The Discovery client has always
--     sent these (discovery-consolidated-draft.html:5144-5148) and the
--     portfolios route has always dropped them -- it reads series,
--     selectedEffectIds, sourceImageRef, returnUrl and clientPriceUsd, and
--     nothing else. So the pose step chose a pose that reached nothing, and
--     renderOnePortfolioItem's hardcoded framing:'bust' made every piece 1:1
--     whatever the customer picked.
--
--     These columns capture the choice for EVERY size. Only a purchased
--     portfolio reads them back at render, so 4/8/16 output is unchanged --
--     the data is now recorded, and honouring it for bundles later is a
--     one-line change rather than another migration.
--
--     framing, not aspect_ratio, because portraits/generate:319 derives
--     aspect FROM framing and ignores a client aspect outright
--     (ASPECT_FOR_FRAMING: bust 1:1, signature 1:1, statuesque 3:4).
--
-- Nullable with no default: null means "not captured", which is the honest
-- state for every row that predates this.

alter table portfolios
  add column if not exists delivery text not null default 'preview',
  add column if not exists pose     text,
  add column if not exists framing  text,
  add column if not exists subject  text;

alter table portfolios drop constraint if exists portfolios_delivery_check;
alter table portfolios add  constraint portfolios_delivery_check
  check (delivery in ('preview', 'purchased'));

comment on column portfolios.delivery is
  'preview = pieces render locked and are unlocked with an entitlement (4/8/16). purchased = pieces are bought outright and render already unlocked (size 1). Written explicitly at checkout from the purchase size table; never inferred from size, free_unlocks or status.';
comment on column portfolios.pose is
  'Customer pose choice, passed to portraits/generate as pose_id. Captured for every size; applied only when delivery = purchased.';
comment on column portfolios.framing is
  'Customer composition choice: bust | signature | statuesque. Aspect ratio is derived from this by portraits/generate, never sent directly. Captured for every size; applied only when delivery = purchased.';
comment on column portfolios.subject is
  'Customer subject choice, passed to portraits/generate. Captured for every size; applied only when delivery = purchased.';
