-- 049_gift_composition_geometry.sql
--
-- Gift Wizard: product-specific compositions that are shared between compatible products.
--
-- NOT APPLIED. Requires 048. Additive and idempotent: nullable-or-defaulted columns, two checks and an index on gift_compositions.
-- No function changes: gift_approve_order, gift_select_artwork and gift_use_correction already work per order line, and each
-- purchased line keeps its OWN composition row (its own approval, its own free correction, its own print job). What changes is
-- that rows for products with the same picture shape now point at the SAME files, because they were composed once.
--
--   geometry_key           the composition requirement this row satisfies ('a667' = a 2:3 picture); rows with the same key,
--                          for the same artwork, share files
--   method                 'deterministic' (the artwork already fits, or bounded background extension) or 'generated' (a
--                          separate NB2.1 generation at a supported aspect ratio, finished by bounded extension)
--   source_composition_id  the row whose files this one reuses; null for the row that created them and for a line's own
--                          correction (a correction always gets files of its own, so it never changes another line's picture)
--   generation_mode        how the picture was made: 'none' (adapted from the selected artwork, no model call), 'favorite_reference'
--                          (a NEW NB2.1 generation given the selected artwork as a reference image) or 'photo_regeneration' (a NEW
--                          generation from the customer's photograph alone, for a series whose route cannot take a reference).
--                          A new generation is never assumed identical to the selected artwork: each line is approved on what it shows.
--   generation_aspect      the NB2.1 aspect ratio requested, when a model call was made
--   nb21_calls, outpaint_calls   exact paid-call counts for the row that created the files (0 for rows that reuse them)
--   cost_usd_est           estimated dollars, only when a unit price is configured; null otherwise (never a guess)
--   The artwork a composition is made from is preview_id (already present): the customer's selected favorite.

alter table public.gift_compositions
  add column if not exists geometry_key text,
  add column if not exists method text not null default 'deterministic',
  add column if not exists source_composition_id uuid references public.gift_compositions(id) on delete set null,
  add column if not exists generation_mode text not null default 'none',
  add column if not exists generation_aspect text,
  add column if not exists nb21_calls int not null default 0,
  add column if not exists outpaint_calls int not null default 0,
  add column if not exists cost_usd_est numeric(10,4);

do $$ begin
  alter table public.gift_compositions add constraint gift_compositions_method_check check (method in ('deterministic', 'generated'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.gift_compositions add constraint gift_compositions_generation_mode_check check (generation_mode in ('none', 'favorite_reference', 'photo_regeneration'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.gift_compositions add constraint gift_compositions_calls_check check (nb21_calls >= 0 and outpaint_calls >= 0 and (cost_usd_est is null or cost_usd_est >= 0));
exception when duplicate_object then null; end $$;

create index if not exists gift_compositions_geometry_idx on public.gift_compositions(session_id, preview_id, geometry_key);
