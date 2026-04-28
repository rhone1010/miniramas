-- 003_store_commerce.sql
-- Commerce layer for miniRama: skus catalog, purchases, entitlements, refund cap.
--
-- Naming note: the existing `bundles` + `bundle_items` tables (Stream 1) are
-- a *different* product — admin-curated style packs the /groups page consumes
-- directly. This migration introduces a generic SKU/entitlement model that
-- coexists with that, used by /store, /create, and /account. They share zero
-- table names; user-facing copy for this layer should say "packs" / "credits"
-- and reserve "bundle" for the curated-style-pack product.

-- ─── SKUs (admin catalog of purchasable products) ──────────────────
create table if not exists skus (
  id              text primary key,
  display_name    text not null,
  kind            text not null check (kind in ('single', 'bundle')),
  count           integer not null check (count > 0),
  price_cents     integer not null check (price_cents > 0),
  stripe_price_id text not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ─── Purchases (one row per Stripe Checkout session) ───────────────
-- We don't keep our own users table — Supabase Auth owns identity.
-- user_id references auth.users(id); guest singles use guest_email.
create table if not exists purchases (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users(id),
  guest_email        text,
  sku_id             text references skus(id) not null,
  stripe_session_id  text unique not null,
  stripe_charge_id   text unique,
  amount_cents       integer not null,
  status             text not null check (status in
                       ('pending', 'paid', 'failed', 'refunded'))
                     default 'pending',
  created_at         timestamptz not null default now(),
  paid_at            timestamptz,
  constraint identity_required check (
    user_id is not null or guest_email is not null
  )
);

create index if not exists idx_purchases_user    on purchases (user_id, created_at desc);
create index if not exists idx_purchases_session on purchases (stripe_session_id);

-- ─── Entitlements (one row per redeemable generation) ──────────────
-- Singles lock locked_style/locked_variant at purchase time.
-- Bundle credits leave them null until consumeEntitlement locks them at
-- redemption.
create table if not exists entitlements (
  id                    uuid primary key default gen_random_uuid(),
  purchase_id           uuid references purchases(id) not null,
  user_id               uuid references auth.users(id),
  guest_email           text,
  locked_style          text,
  locked_variant        text,
  status                text not null check (status in
                          ('available', 'pending', 'consumed', 'restored'))
                        default 'available',
  job_id                uuid,
  generation_started_at timestamptz,
  consumed_at           timestamptz,
  restored_at           timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists idx_entitlements_user_status on entitlements (user_id, status);
create index if not exists idx_entitlements_purchase    on entitlements (purchase_id);
create index if not exists idx_entitlements_job         on entitlements (job_id);

-- ─── Refund cap (abuse prevention) ─────────────────────────────────
create table if not exists refund_log (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id),
  guest_email    text,
  entitlement_id uuid references entitlements(id) not null,
  reason         text not null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_refund_log_user_day  on refund_log (user_id,     created_at);
create index if not exists idx_refund_log_email_day on refund_log (guest_email, created_at);

-- ─── Atomic consume helper ─────────────────────────────────────────
-- Called by lib/store/entitlements.ts consumeEntitlement(). Wraps the
-- conditional update + identity check in a single statement so two
-- concurrent callers can't both win. Returns the row if the update
-- succeeded, otherwise zero rows.
--
-- The caller decides whether the missing row means 'already_consumed'
-- (a row exists with status='consumed' for this id) or 'not_found' /
-- 'wrong_owner' (no row matches the identity guard).
create or replace function consume_entitlement_atomic(
  p_entitlement_id uuid,
  p_job_id         uuid,
  p_style          text,
  p_variant        text,
  p_user_id        uuid,
  p_guest_email    text
)
returns entitlements
language plpgsql
as $$
declare
  updated entitlements;
begin
  update entitlements
     set status         = 'consumed',
         locked_style   = coalesce(locked_style,   p_style),
         locked_variant = coalesce(locked_variant, p_variant),
         job_id         = p_job_id,
         consumed_at    = now()
   where id = p_entitlement_id
     and status in ('available', 'pending')
     and ( (p_user_id is not null and user_id = p_user_id)
        or (p_guest_email is not null and guest_email = p_guest_email) )
     -- If the entitlement has a locked style+variant already, the caller
     -- must match it. Bundle credits have nulls, so this passes through.
     and (locked_style   is null or locked_style   = p_style)
     and (locked_variant is null or locked_variant = p_variant)
   returning * into updated;
  return updated;
end;
$$;

grant all on skus         to service_role;
grant all on purchases    to service_role;
grant all on entitlements to service_role;
grant all on refund_log   to service_role;
grant execute on function consume_entitlement_atomic(uuid, uuid, text, text, uuid, text)
             to service_role;
