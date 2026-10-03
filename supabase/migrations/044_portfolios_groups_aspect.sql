-- Permit the existing Groups landscape format; preserve all other values and NULL.
alter table public.portfolios
  drop constraint portfolios_aspect_ratio_check,
  add constraint portfolios_aspect_ratio_check
    check (aspect_ratio is null or aspect_ratio in ('1:1','3:4','4:3','9:16','2:3','3:2'));
