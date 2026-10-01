-- groups_commerce.sql
--
-- NOT DATABASE-VERIFIED. Written September 2026; requires Rich's approval
-- before execution.
--
-- Groups flat-rate commerce. Reuses existing entitlements infrastructure:
--   - Groups craft rights are entitlements with locked_style = 'groups_craft'
--   - Included unlocks are generic entitlements (locked_style = null),
--     identical to the basket path's global unlocks
--
-- No new tables. No new functions. Included unlock count is derived in
-- code from GROUPS_PACKAGES (lib/v1/groups/groups-commerce.ts).
--
-- This migration:
--   1. Widens the skus.kind constraint to include 'groups'
--   2. Inserts the 4 Groups SKU rows with test-mode Stripe Price IDs

-- 1. Widen skus.kind to accept 'groups'
ALTER TABLE skus DROP CONSTRAINT IF EXISTS skus_kind_check;
ALTER TABLE skus ADD CONSTRAINT skus_kind_check
  CHECK (kind IN ('single', 'bundle', 'credits', 'basket', 'groups'));

-- 2. Insert the four Groups SKU rows
-- Test-mode Stripe Price IDs. Production IDs must be updated before launch.
-- count = number of crafts in the package.
-- Included unlocks (0/1/2/4) are derived in code, not stored in the DB.
INSERT INTO skus (id, display_name, kind, count, price_cents, stripe_price_id, active)
VALUES
  ('groups_1',  '1 Group Craft',   'groups',  1,  499, 'price_1ULTGVCWHIffAtyWbMcHDmxM', true),
  ('groups_4',  '4 Group Crafts',  'groups',  4,  899, 'price_1ULTH6CWHIffAtyWPnC8AhnW', true),
  ('groups_8',  '8 Group Crafts',  'groups',  8, 1399, 'price_1ULTHUCWHIffAtyWxJUWWz9b', true),
  ('groups_16', '16 Group Crafts', 'groups', 16, 2199, 'price_1ULTHrCWHIffAtyWGDHEiru0', true)
ON CONFLICT (id) DO UPDATE SET
  display_name    = EXCLUDED.display_name,
  kind            = EXCLUDED.kind,
  count           = EXCLUDED.count,
  price_cents     = EXCLUDED.price_cents,
  stripe_price_id = EXCLUDED.stripe_price_id,
  active          = EXCLUDED.active;
