-- 058: keep HOW each initial preview was generated, with the preview.
--
-- NOT APPLIED. Additive and idempotent: one nullable column on gift_previews. Existing rows keep null (the application treats null as "no record"), and the application also works WITHOUT this
-- migration (it stores the preview and drops the record), so applying it is not a prerequisite for anything.
--
--   gift_previews.generation   jsonb  { v, series, effectId, aspect, attempts, passed, quality ('passed' | 'below_bar' | 'unscored'), reason, scores, postProcessing { outpaint, skipped }, durationMs }
--
-- Written by the service role only (no policy or grant changes: gift_previews is already closed to browser roles by 047).

alter table public.gift_previews add column if not exists generation jsonb;
