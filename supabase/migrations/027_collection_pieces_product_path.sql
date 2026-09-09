-- 027_collection_pieces_product_path.sql
--
-- Which product made this piece. Portraits and Discovery are separate
-- product paths with separate collections, ruled 2026-09-09.
--
-- Discovery's My Collection was loading the account-wide shelf, so a
-- Discovery customer saw every Portraits, Pets, Groups and Halloween piece
-- the account had ever crafted -- 166 of them for the first test account,
-- none of them made in Discovery.
--
-- Nothing already persisted can answer "which product made this". `series`
-- is 'portraits' on both paths, `mode` collides ('material' appears on two
-- 2026-07 Portraits rows and is what the Discovery writer would also use),
-- and there is no purchase, entitlement or job linkage on the table at all.
-- meta is unconstrained jsonb and holds nothing authoritative. So the
-- discriminator has to be written, not inferred -- no dates, labels, preset
-- names or sequence numbers.
--
-- Defaulted to 'portraits' and NOT NULL, so every existing row is correctly
-- owned by the path that actually made it the moment this lands: all 203
-- rows in the live table predate Discovery's shelf writer, which does not
-- exist in production yet. There is no backfill to do and none to get wrong.
-- This is the cheapest moment this column will ever be added.
--
-- Text rather than an enum: a third product path should be a value, not a
-- type migration.

alter table collection_pieces
  add column if not exists product_path text not null default 'portraits';

comment on column collection_pieces.product_path is
  'Which product path created this piece: portraits | discovery. Written explicitly at insert, never inferred from series, mode, meta, label or date.';

-- Every read is owner + product_path + created_at, which is what the shelf
-- route asks for.
create index if not exists idx_collection_pieces_owner_product
  on collection_pieces (owner_key, product_path, created_at desc);
