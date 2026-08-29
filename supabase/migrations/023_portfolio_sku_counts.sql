-- 023_portfolio_sku_counts.sql
-- Fixed purchase sizes for Portfolio: 1, 4, 8, 16.
-- Same Stripe prices, same SKU rows - only the count column changes
-- to reflect what each SKU means under Portfolio pricing.
-- single stays at count=1 (unchanged).

UPDATE skus SET count = 4  WHERE id = 'basket_discover_5';
UPDATE skus SET count = 8  WHERE id = 'basket_discover_10';
UPDATE skus SET count = 16 WHERE id = 'basket_discover_20';
