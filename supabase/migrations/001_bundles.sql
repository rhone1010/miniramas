-- 001_bundles.sql
-- Bundle catalog for the admin-managed Groups store.
--
-- A "bundle" is a fixed-price SKU that produces N images at purchase time.
-- Each bundle has 1..N items. An item is either:
--   - 'fixed':  a specific (style, variant) pair the bundle always produces
--   - 'choose': a slot the customer picks from a list of (style, variant) options
--
-- All admin/customer access is via Next.js API routes using the service role key.
-- No RLS — we don't expose Supabase to the client.

create table if not exists bundles (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  tagline         text,
  price_cents     integer not null check (price_cents >= 0),
  display_order   integer not null default 0,
  is_active       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists bundles_active_order on bundles (is_active, display_order)
  where is_active = true;

create table if not exists bundle_items (
  id              uuid primary key default gen_random_uuid(),
  bundle_id       uuid not null references bundles(id) on delete cascade,
  position        integer not null,
  mode            text not null check (mode in ('fixed', 'choose')),
  fixed_style     text,
  fixed_variant   text,
  choose_label    text,
  choose_options  jsonb,
  created_at      timestamptz not null default now(),
  constraint fixed_requires_style_variant
    check (mode != 'fixed' or (fixed_style is not null and fixed_variant is not null)),
  constraint choose_requires_options
    check (mode != 'choose' or (choose_options is not null)),
  unique (bundle_id, position)
);

create index if not exists bundle_items_bundle_pos on bundle_items (bundle_id, position);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists bundles_updated_at on bundles;
create trigger bundles_updated_at
  before update on bundles
  for each row execute function update_updated_at();
