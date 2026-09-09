-- 030_portfolios_aspect_ratio.sql
--
-- The canvas the customer chose, recorded separately from the composition.
--
-- 029 added `framing` on the assumption that carrying the aspect meant
-- choosing the framing that produced it -- portraits/generate derives aspect
-- from framing and ignores a client aspect, so that looked like the only
-- lever. It made 3:4 mean "statuesque", which quietly changed the
-- composition block for a customer who only ever picked a canvas shape.
--
-- Ruled 2026-09-09: framing and aspect are SEPARATE CONCERNS.
--   framing = which verbatim composition block describes the subject
--             (Signature | Bust | Statuesque)
--   aspect  = the shape of the canvas it is rendered on
--
-- Discovery has no framing step. It has an aspect step offering Square 1:1,
-- Portrait 3:4 and Landscape 4:3, and all three use the Bust composition
-- block. So framing stays 'bust' for every purchased piece -- exactly what
-- renderOnePortfolioItem has always sent -- and this column carries the
-- choice the customer actually made.
--
-- Nullable, no default: null means "not captured", which is the honest state
-- for the six portfolios that predate this and for every 4/8/16 bundle,
-- none of which read it.

alter table portfolios
  add column if not exists aspect_ratio text;

alter table portfolios drop constraint if exists portfolios_aspect_ratio_check;
alter table portfolios add  constraint portfolios_aspect_ratio_check
  check (aspect_ratio is null or aspect_ratio in ('1:1', '3:4', '4:3'));

comment on column portfolios.aspect_ratio is
  'Canvas ratio the customer selected: 1:1 Square | 3:4 Portrait | 4:3 Landscape. Sent to portraits/generate as output_aspect_ratio, and only when delivery = purchased. Independent of framing, which stays bust for all three.';
