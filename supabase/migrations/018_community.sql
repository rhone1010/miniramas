-- supabase/migrations/018_community.sql
--
-- THE COMMUNITY BOARD.
--
-- Spec: docs/GOVERNANCE/COMMUNITY-BOARD-SPEC-2026-08-10.md
--
-- Written against the live schema as read on 10 August 2026, not against a
-- document: collection_pieces (id, owner_key, series, preset, image_path,
-- archived), identity_map (owner_key, user_id, email), credit_ledger
-- (owner_key, delta, reason, ref_id, balance_after).
--
-- NUMBERING. 016 is taken twice already - 016_error_log.sql is committed and
-- 016_support_messages.sql is sitting untracked. This is 018 to stay clear of
-- both; renumber the support one to 019 before committing it.
--
-- EVERYTHING KEYS ON owner_key. Every other table in this build does, user_id
-- is nullable throughout, and one identity column that is sometimes null is
-- how a join quietly returns nothing.

begin;

-- ---------------------------------------------------------------------------
-- HANDLES
--
-- identity_map holds owner_key, user_id and email and nothing a person would
-- want under their own portrait. A UUID reads as machine output; an email
-- address is a thing we must never print.
--
-- Set at first post rather than at signup. Somebody who never posts is never
-- asked to invent a name for themselves.
-- ---------------------------------------------------------------------------
create table if not exists community_handles (
  owner_key    text primary key,
  handle       text        not null,
  created_at   timestamptz not null default now(),
  changed_at   timestamptz,
  -- A released handle is held for thirty days before anybody else may take
  -- it, so a name somebody is known by cannot be grabbed the instant they
  -- edit it.
  released_at  timestamptz,
  constraint community_handle_shape
    check (handle ~ '^[A-Za-z0-9_-]{3,20}$')
);

-- Case-insensitive uniqueness. Two people called rich1hone and Rich1Hone are
-- the same person to everybody reading the board.
create unique index if not exists community_handles_lower_uniq
  on community_handles (lower(handle));

comment on table community_handles is
  'Display names for the community board. Never the email. Set at first post.';


-- ---------------------------------------------------------------------------
-- POSTS
--
-- effect_id, series and image_path are DENORMALISED off collection_pieces on
-- purpose. The board has to survive the piece being archived, and the deep
-- link out of a post needs the effect without a join to a table the poster
-- may since have emptied.
-- ---------------------------------------------------------------------------
create table if not exists community_posts (
  id            uuid primary key default gen_random_uuid(),
  piece_id      uuid        not null references collection_pieces(id) on delete cascade,
  owner_key     text        not null,
  effect_id     text        not null,
  series        text        not null default 'portraits',
  image_path    text        not null,

  -- WHAT THEY AGREED TO, IN THEIR OWN RECORD. Not a boolean: a boolean tells
  -- you somebody ticked something, and a year later nobody can say what.
  consented_at  timestamptz not null default now(),
  consent_text  text        not null,

  state         text        not null default 'live',
  heart_count   integer     not null default 0,
  created_at    timestamptz not null default now(),
  withdrawn_at  timestamptz,

  constraint community_posts_state
    check (state in ('live', 'withdrawn', 'removed')),
  -- One post per piece, ever. Enforced here rather than in the glass, because
  -- the ten-posts reward counts pieces and a second row for the same piece
  -- would be a free craft.
  constraint community_posts_piece_once unique (piece_id)
);

-- The board's only real query: live posts, newest first.
create index if not exists community_posts_board
  on community_posts (created_at desc)
  where state = 'live';

create index if not exists community_posts_owner
  on community_posts (owner_key, created_at desc);

comment on column community_posts.consent_text is
  'The exact wording the poster agreed to, copied at the moment of posting.';


-- ---------------------------------------------------------------------------
-- HEARTS
--
-- Once, ever, per person per post. The primary key IS the rule - a uniqueness
-- constraint cannot be talked past the way a check in a route can.
--
-- No un-hearting. Un-hearting exists so people can manage how they look to
-- others, which is a feed problem, and this is not a feed. It also keeps the
-- count a number rather than something that can be toggled.
-- ---------------------------------------------------------------------------
create table if not exists community_hearts (
  post_id     uuid        not null references community_posts(id) on delete cascade,
  owner_key   text        not null,
  created_at  timestamptz not null default now(),
  primary key (post_id, owner_key)
);

-- heart_count is kept on the post row. A count(*) per card is the query that
-- kills the page at a thousand posts, and this board is meant to be found by
-- strangers.
create or replace function community_heart_count() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update community_posts
       set heart_count = heart_count + 1
     where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update community_posts
       set heart_count = greatest(heart_count - 1, 0)
     where id = old.post_id;
  end if;
  return null;
end $$;

drop trigger if exists community_hearts_count on community_hearts;
create trigger community_hearts_count
  after insert or delete on community_hearts
  for each row execute function community_heart_count();


-- ---------------------------------------------------------------------------
-- COMMENTS AND IDEAS
--
-- One table. An idea is a comment with no post attached - same classifier,
-- same digest, same handles, and a second table would drift from the first
-- the week somebody changes the moderation rules.
--
-- No threading. A thread is where a board becomes an argument, and an
-- argument is a queue somebody has to read.
-- ---------------------------------------------------------------------------
create table if not exists community_comments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid references community_posts(id) on delete cascade,
  owner_key     text        not null,
  body          text        not null,
  kind          text        not null default 'comment',
  state         text        not null default 'live',
  held_reason   text,
  -- Ideas only. Somebody who suggested an effect in September and sees it
  -- marked built in November is a customer for life.
  built         boolean     not null default false,
  created_at    timestamptz not null default now(),

  constraint community_comments_kind  check (kind  in ('comment', 'idea')),
  constraint community_comments_state check (state in ('held', 'live', 'removed')),
  constraint community_comments_body  check (char_length(body) between 1 and 500),
  -- A comment needs something to be about; an idea must not have one.
  constraint community_comments_shape check (
    (kind = 'comment' and post_id is not null) or
    (kind = 'idea'    and post_id is null)
  )
);

create index if not exists community_comments_post
  on community_comments (post_id, created_at)
  where state = 'live';

create index if not exists community_comments_ideas
  on community_comments (created_at desc)
  where kind = 'idea' and state = 'live';

-- The digest reads this twice a day. Held first, oldest first - the thing
-- that has been waiting longest is the thing somebody is waiting on.
create index if not exists community_comments_held
  on community_comments (created_at)
  where state = 'held';


-- ---------------------------------------------------------------------------
-- REPORTS
--
-- Quiet. No public count, no visible outcome. Three distinct reporters pulls
-- an item pending review, which means a small number of people can hide
-- something briefly - accepted, because the alternative is that abuse stands
-- until the next digest.
-- ---------------------------------------------------------------------------
create table if not exists community_reports (
  id           uuid primary key default gen_random_uuid(),
  target_kind  text        not null,
  target_id    uuid        not null,
  owner_key    text        not null,
  created_at   timestamptz not null default now(),
  constraint community_reports_kind check (target_kind in ('post', 'comment')),
  constraint community_reports_once unique (target_kind, target_id, owner_key)
);

create index if not exists community_reports_target
  on community_reports (target_kind, target_id);


-- ---------------------------------------------------------------------------
-- THE TEN-POST REWARD
--
-- Hearts earn nothing - hearting is free to the person doing it, so anything
-- it buys is a thing to manufacture. Posting earns, because a post requires a
-- craft and a craft costs credits: ten posts is roughly a hundred credits
-- already spent. A ten per cent rebate on work somebody chose to show in
-- public.
--
-- This table exists so a threshold cannot be paid twice. The count is over
-- DISTINCT PIECES that are still live, so withdrawing and re-posting earns
-- nothing and a removed post earns nothing.
-- ---------------------------------------------------------------------------
create table if not exists community_rewards (
  owner_key   text        not null,
  threshold   integer     not null,
  awarded_at  timestamptz not null default now(),
  primary key (owner_key, threshold)
);

comment on table community_rewards is
  'One row per ten-post threshold paid. The primary key stops a threshold being paid twice.';

-- How many live posts somebody has, counted the way the reward counts them.
create or replace function community_live_post_count(p_owner text)
returns integer
language sql stable as $$
  select count(distinct piece_id)::int
    from community_posts
   where owner_key = p_owner
     and state = 'live';
$$;


-- ---------------------------------------------------------------------------
-- THE BOARD, AS THE PAGE READS IT
--
-- A view rather than a join written out in the route, so signed-out reads and
-- signed-in reads cannot drift apart. It exposes the handle and nothing else
-- about the person: no owner_key, no email, no user_id. A view is the only
-- place that guarantee can be made once.
-- ---------------------------------------------------------------------------
create or replace view community_board as
  select
    p.id,
    p.effect_id,
    p.series,
    p.image_path,
    p.heart_count,
    p.created_at,
    h.handle,
    (select count(*) from community_comments c
      where c.post_id = p.id and c.state = 'live') as comment_count
  from community_posts p
  left join community_handles h on h.owner_key = p.owner_key
  where p.state = 'live';

comment on view community_board is
  'What a visitor sees. Carries the handle and never the owner_key or email.';


-- ---------------------------------------------------------------------------
-- ACCESS
--
-- RLS on, no policies. Every route in this build reaches Supabase with the
-- service key and scopes by owner_key itself; the anon key must not be able
-- to read these tables directly, and a table with RLS enabled and no policy
-- is closed to everybody the service role is not.
--
-- The board is public to READ, but that read goes through
-- GET /api/v1/community/posts, which is where the state filter and the
-- handle-only projection live. Opening the table to anon would route around
-- both.
-- ---------------------------------------------------------------------------
alter table community_handles  enable row level security;
alter table community_posts    enable row level security;
alter table community_hearts   enable row level security;
alter table community_comments enable row level security;
alter table community_reports  enable row level security;
alter table community_rewards  enable row level security;

commit;
