-- migrations/015_launch_invites.sql
--
-- WHO WAS INVITED, AND WHAT THEY WERE PROMISED.
--
-- The soft-launch gate asks for an email beside the passcode. This table is
-- where that lands. One row per address.
--
-- A row is a PROMISE, not a balance. At the moment it is written there is
-- no account — only an address typed into a passcode card by somebody who
-- may never sign in. The credits are claimed on first sign-in, and
-- claimed_at is what stops them being claimed twice.
--
-- Run in the Supabase SQL editor.

create table if not exists public.launch_invites (
  email            text primary key,
  credits_granted  integer     not null default 0,
  over_cap         boolean     not null default false,
  created_at       timestamptz not null default now(),

  -- Set when the grant is actually paid into an account. Null means the
  -- address came through the gate and never signed in.
  claimed_at       timestamptz,
  claimed_by       uuid,

  -- Reserved for the note Rich may want against a name later.
  note             text
);

comment on table public.launch_invites is
  'Soft-launch invitations. One row per email taken at the passcode gate. '
  'credits_granted is a promise; claimed_at is when it was paid.';

comment on column public.launch_invites.over_cap is
  'True when the invite arrived after the 40-account ceiling. The person '
  'still gets in and is still recorded; they just carry no grant.';

-- The claim path looks up by claimed_by, and the admin panel counts by
-- claimed_at. Both want an index; email is already the primary key.
create index if not exists launch_invites_claimed_by_idx
  on public.launch_invites (claimed_by);

create index if not exists launch_invites_claimed_at_idx
  on public.launch_invites (claimed_at);

-- SERVICE ROLE ONLY. Nothing here is ever read by a browser: it is a list
-- of every person invited to the soft launch, and /api is not behind the
-- gate. RLS on with no policy means anon and authenticated both see
-- nothing, which is the intent.
alter table public.launch_invites enable row level security;
