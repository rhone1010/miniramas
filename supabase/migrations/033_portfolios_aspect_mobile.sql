-- 033_portfolios_aspect_mobile.sql
--
-- MOBILE IS A FOURTH FORMAT, NOT A CROP.
--
-- Migration 030 constrained portfolios.aspect_ratio to '1:1', '3:4' and
-- '4:3'. Rich's design pass (2026-09-18) adds Mobile to the Format step as a
-- real native 9:16 render -- matrix B2, "Native NB2 output, not crop".
--
-- WHY THIS MIGRATION HAD TO COME FIRST. Without it the client could offer
-- Mobile and the checkout would still refuse it: normalizeAspectChoice would
-- record null, the piece would fall through to the framing-derived aspect,
-- and the customer would pay for a phone-shaped portrait and receive a
-- square one. That failure is silent -- a warning in a log nobody reads --
-- which is exactly why the constraint is the first thing to move.
--
-- NB2 has rendered 9:16 since August for the wallpaper room
-- (lib/v1/shared/render-aspect.ts:54), so nothing new is being asked of the
-- generator. What is new is that Portraits may now ask for it.
--
-- Existing rows are unaffected: this widens the allowed set and removes
-- nothing. No data is rewritten.

alter table portfolios drop constraint if exists portfolios_aspect_ratio_check;
alter table portfolios add  constraint portfolios_aspect_ratio_check
  check (aspect_ratio is null or aspect_ratio in ('1:1', '3:4', '4:3', '9:16'));

comment on column portfolios.aspect_ratio is
  'Canvas ratio the customer selected: 1:1 Square | 3:4 Portrait | 4:3 Landscape | 9:16 Mobile. Sent to portraits/generate as output_aspect_ratio, and only when delivery = purchased. Independent of framing, which stays bust for all four. A 9:16 render also carries PHONE_COMPOSITION (lib/v1/shared/render-aspect.ts) so the subject sits low with a quiet upper third.';
