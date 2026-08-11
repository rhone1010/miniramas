-- migrations/016_support_messages.sql
--
-- WHAT PEOPLE WROTE TO US.
--
-- The Concierge answers questions and cannot touch an account. When
-- somebody needs something done she takes a message, and it lands here
-- before it is emailed.
--
-- THE ROW IS THE RECORD, THE EMAIL IS THE NOTIFICATION. Mail bounces,
-- APIs have bad days, and a message the customer typed must survive all
-- of that. Written first, sent second.
--
-- Run in the Supabase SQL editor.

create table if not exists public.support_messages (
  id          uuid        primary key default gen_random_uuid(),

  -- Null when they wrote signed out. reply_to is never null: a message we
  -- cannot answer is not worth taking.
  user_id     uuid,
  reply_to    text        not null,

  subject     text        not null default 'A message from the workshop',
  body        text        not null,

  -- Whatever the page knew at the time: credits, where they were standing,
  -- the piece they were looking at. Kept loose on purpose — the useful
  -- field is always the one nobody thought to add a column for.
  context     jsonb       not null default '{}'::jsonb,

  created_at  timestamptz not null default now(),

  -- Rich's side of it.
  handled_at  timestamptz,
  handled_by  text,
  note        text
);

comment on table public.support_messages is
  'Messages taken by the Concierge and emailed onward. The row is the '
  'record; the email is the notification.';

-- The rate check reads by address and time, and the admin panel will want
-- the unhandled ones first.
create index if not exists support_messages_reply_to_idx
  on public.support_messages (reply_to, created_at desc);

create index if not exists support_messages_open_idx
  on public.support_messages (created_at desc)
  where handled_at is null;

-- SERVICE ROLE ONLY. Every row is somebody's complaint with their address
-- attached, and /api is not behind the soft-launch gate. RLS on with no
-- policy means anon and authenticated both see nothing, which is intended.
alter table public.support_messages enable row level security;
