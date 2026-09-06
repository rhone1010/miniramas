-- 026_cart_skus_seed.sql
-- The two cart SKUs createCartCheckout writes against.
--
-- purchases.sku_id is NOT NULL and a foreign key to skus(id), so a cart or
-- unlock checkout cannot write its purchase row unless these ids exist.
-- checkout.ts:326-327 says they are "seeded (inactive) purely to satisfy it"
-- — but no migration in this repo seeds them, so the assertion is unverified
-- against a fresh database. Without them the $2.99 unlock fails at the
-- purchase insert with a foreign key violation, after the Stripe session has
-- already been created.
--
-- Idempotent and inactive on purpose. If they are already present in the live
-- database this changes nothing; `active = false` keeps them out of any SKU
-- listing, because neither is a thing a customer chooses — the price is
-- computed per line item by createCartCheckout, not read from these rows.
--
-- price_cents is the count-of-1 rate each path charges: 399 for a cart piece
-- (VOLUME_LADDER), 299 for one unlock (UNLOCK_UNIT_CENTS). Recorded here for
-- readability only; the server total is computed in checkout.ts and these
-- values are never read.
--
-- stripe_price_id is empty because these SKUs have no fixed Stripe price:
-- createCartCheckout builds price_data per line item (checkout.ts:305-312).

insert into skus (id, display_name, kind, count, price_cents, stripe_price_id, active)
values
  ('portrait_pieces_cart', 'Crafted Pieces (cart)', 'single', 1, 399, '', false),
  ('portrait_unlock_web',  'Unlock (web quality)',  'single', 1, 299, '', false)
on conflict (id) do nothing;
