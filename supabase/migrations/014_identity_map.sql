-- 014_identity_map.sql
-- Liten & Co — one row per customer, resolving every identity the app uses.
--
-- The database currently carries three live identity models:
--   owner_key    — credits, collection, print orders, account flags
--   user_id      — purchases, entitlements, refund_log (Supabase auth)
--   guest_email  — purchases, entitlements, refund_log
--
-- owner_key is the spine because it exists from a visitor's first moment,
-- before any signup. user_id is written onto the same row at sign-in, so
-- nothing that happened pre-signup is orphaned — including the campaign
-- that brought them.
--
-- anon_id is reserved for the events layer (015).

begin;

create table if not exists public.identity_map (
  owner_key   text primary key,
  user_id     uuid,
  email       text,
  anon_id     uuid,
  first_seen  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$ begin alter table public.identity_map add constraint identity_map_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
exception when duplicate_object or duplicate_table then null; end $$;

create unique index if not exists identity_map_user_id_uidx on public.identity_map (user_id) where user_id is not null;
create index        if not exists identity_map_email_idx    on public.identity_map (lower(email));
create index        if not exists identity_map_anon_idx     on public.identity_map (anon_id);

-- ── Backfill ────────────────────────────────────────────────
-- Every owner_key we have ever seen, from all live sources.
insert into public.identity_map (owner_key, first_seen)
select owner_key, min(created_at) from (
  select owner_key, created_at from public.collection_pieces
  union all select owner_key, created_at from public.craft_events
  union all select owner_key, created_at from public.credit_ledger
  union all select owner_key, redeemed_at from public.code_redemptions
  union all select owner_key, updated_at from public.credit_balances
  union all select owner_key, updated_at from public.account_flags
  union all select owner_key, updated_at from public.account_addresses
  union all select owner_key, created_at from public.print_orders where owner_key is not null
) s
where owner_key is not null
group by owner_key
on conflict (owner_key) do nothing;

-- collection_pieces is the only table carrying both keys — the bridge.
update public.identity_map m
set    user_id = p.user_id, updated_at = now()
from  (select distinct on (owner_key) owner_key, user_id
       from public.collection_pieces
       where user_id is not null
       order by owner_key, created_at) p
where m.owner_key = p.owner_key and m.user_id is null;

-- Email from print orders where the owner_key is known.
update public.identity_map m
set    email = o.customer_email, updated_at = now()
from  (select distinct on (owner_key) owner_key, customer_email
       from public.print_orders
       where owner_key is not null
       order by owner_key, created_at desc) o
where m.owner_key = o.owner_key and m.email is null;

-- Email from auth for anyone already resolved to a user_id.
update public.identity_map m
set    email = u.email, updated_at = now()
from   auth.users u
where  m.user_id = u.id and m.email is null;

commit;

-- ── Coverage check — run after applying ──────────────────────
-- select count(*) total,
--        count(user_id) with_user,
--        count(email)   with_email
-- from public.identity_map;
