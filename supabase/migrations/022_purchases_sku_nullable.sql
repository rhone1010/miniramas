-- 022_purchases_sku_nullable.sql
-- Portfolio purchases use dynamic pricing (resolveSelectionOffer) with no
-- fixed SKU row. Allow sku_id to be NULL so createPortfolioCheckout can
-- insert a purchase without a SKU reference.

ALTER TABLE public.purchases ALTER COLUMN sku_id DROP NOT NULL;
