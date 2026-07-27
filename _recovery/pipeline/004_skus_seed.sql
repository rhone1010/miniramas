-- 004_skus_seed.sql
-- Seed two starter SKUs: a single and a 4-pack.
--
-- TODO: replace stripe_price_id values with REAL Stripe Price IDs from the
-- Stripe dashboard before running this against any live environment.
-- Create them under https://dashboard.stripe.com/test/prices, then update
-- this file (or run an UPDATE statement directly) so the price_xxx strings
-- below match. Do NOT ship placeholders to prod.

insert into skus (id, display_name, kind, count, price_cents, stripe_price_id, active)
values
  ('single',    'Single Generation',  'single', 1, 199,  'price_REPLACE_SINGLE',   true),
  ('pack_4',    'Four-pack',            'bundle', 4, 599,  'price_REPLACE_PACK_4',   true)
on conflict (id) do update
  set display_name    = excluded.display_name,
      kind            = excluded.kind,
      count           = excluded.count,
      price_cents     = excluded.price_cents,
      stripe_price_id = excluded.stripe_price_id,
      active          = excluded.active;
