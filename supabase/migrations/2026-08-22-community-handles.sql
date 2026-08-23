-- 2026-08-22-community-handles.sql
-- CUI V32. Written for Rich to review and apply. Not applied by CUI.
--
-- WHY: /api/v1/community/handle upserts into public.community_handles and
-- the table does not exist, so every attempt to claim a name fails and the
-- board has never taken a post. The error the customer sees is the route's
-- graceful failure working correctly over a missing table.
--
-- SHAPE IS READ FROM THE ROUTE, NOT INVENTED. Every column below appears
-- in a select, an upsert or a comparison in
-- app/api/v1/community/handle/route.ts as it stands today.
--
-- Reversible. The down is at the foot of this file, commented.

begin;

create table if not exists public.community_handles (
  -- The conflict target. The route upserts with onConflict:'owner_key',
  -- which requires this to be unique, so it is the key.
  owner_key   text        primary key,

  handle      text        not null,

  -- Null until they change it for the first time. The route writes
  -- `mine ? now : null`, so null here means "never changed", not unknown.
  changed_at  timestamptz,

  -- When their OLD name went on hold. The route holds a released name for
  -- thirty days before anybody else may take it.
  released_at timestamptz,

  created_at  timestamptz not null default now()
);

-- ── THE UNIQUENESS RULE, AND A DECISION INSIDE IT ────────────────────────
-- The route looks a handle up with .ilike(), so uniqueness has to be
-- case-insensitive or 'RichRhone' and 'richrhone' are two different people
-- wearing the same name on the board.
--
-- IT IS PARTIAL, ON released_at IS NULL, AND THAT IS A CHOICE.
-- A plain unique index would make the route's own thirty-day branch dead
-- code: it decides a released name is free, allows the caller through, and
-- then the insert fails 23505 anyway. Excluding released rows is what makes
-- that branch mean what it says.
--
-- If the intent was that a released name is never reusable, drop the WHERE
-- and the branch in the route should come out with it.
create unique index if not exists community_handles_handle_key
  on public.community_handles (lower(handle))
  where released_at is null;

-- Nothing reads this table except the route, which holds the service key
-- and bypasses RLS. Enabled with no policies so an anon key cannot read a
-- table of names and owner keys if one is ever pointed at it.
alter table public.community_handles enable row level security;

commit;

-- ── DOWN ─────────────────────────────────────────────────────────────────
-- drop index if exists public.community_handles_handle_key;
-- drop table if exists public.community_handles;
