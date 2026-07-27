-- 006_collection_pieces.sql
-- Durable "My Collection" — crafted pieces persist server-side so they survive
-- a page reload and (for signed-in customers) follow the account across devices.
--
-- Identity: owner_key holds the authenticated user's id when signed in, else a
-- stable per-browser guest token minted client-side. user_id is also stamped
-- when the owner is authenticated so a future "claim guest pieces on sign-in"
-- migration can reconcile the two. Images live in the private 'collection'
-- bucket keyed by owner + piece id; the read API hands back signed URLs.
--
-- This is a NEW table, not an extension of 003's entitlements: entitlements are
-- purchase rights, a collection piece is a crafted artwork. They are unrelated.

create table if not exists collection_pieces (
  id            uuid primary key default gen_random_uuid(),
  owner_key     text not null,                               -- auth user id OR guest token
  user_id       uuid,                                        -- set when owner is authenticated
  series        text not null default 'portraits',
  preset        text,                                        -- material/effect id
  label         text,                                        -- human label shown in the gallery
  mode          text,                                        -- 'material' | 'experimental'
  image_path    text not null,                               -- key in the private 'collection' bucket
  source_path   text,                                        -- optional source thumb (before/after story)
  meta          jsonb not null default '{}'::jsonb,          -- plaque, focal, quality, etc.
  created_at    timestamptz not null default now()
);

create index if not exists idx_collection_pieces_owner on collection_pieces (owner_key, created_at desc);
create index if not exists idx_collection_pieces_user  on collection_pieces (user_id, created_at desc);

alter table collection_pieces enable row level security;
-- No policies on purpose: service-role only. The browser reaches pieces through
-- /api/v1/portraits/pieces, which scopes every query to the caller's owner_key.

-- Private bucket for crafted-piece images. All access is service-role; the read
-- API returns short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('collection', 'collection', false)
on conflict (id) do nothing;
