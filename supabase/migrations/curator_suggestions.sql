-- supabase/migrations/0xx_curator_suggestions.sql
--
-- WHAT THE CURATOR HAS ALREADY ASKED ABOUT.
--
-- One row per suggestion made. It answers three questions the trigger
-- cannot answer without it:
--
--   has it been 48 hours?
--   has she already named this piece?
--   did they act on it?
--
-- ── WHY SHE NEVER ASKS TWICE ABOUT THE SAME PIECE ──────────────────────
--
-- Rich, 19 August. Silence was an answer. Asking a second time about the
-- same photograph reads as nagging, and there are other pieces.
--
-- This extends the existing rule that a dismissed trigger does not re-fire
-- in a session — here it does not re-fire at all, for that piece.
--
-- ── WHY 48 HOURS IS BETWEEN SUGGESTIONS, NOT PER PIECE ─────────────────
--
-- Rich's ruling. She speaks at most every other day whatever the collection
-- does. A customer who crafts ten pieces in an afternoon does not get ten
-- invitations; they get one, and the next no sooner than two days later.

create table if not exists public.curator_suggestions (
  id          uuid primary key default gen_random_uuid(),
  owner_key   text        not null,

  -- The piece she named. Unique per owner: she asks once, ever.
  piece_id    uuid        not null references public.collection_pieces(id) on delete cascade,

  -- What she suggested. One kind today; the table is shaped for more
  -- because the 48-hour gap should be shared across all of them rather
  -- than each kind having its own timer and all of them firing at once.
  kind        text        not null default 'post_to_community'
              check (kind in ('post_to_community')),

  -- What the scorer said, kept for tuning. NEVER RETURNED TO A BROWSER.
  -- See the note in the route.
  score       integer,

  created_at  timestamptz not null default now(),

  -- Set when the piece actually reaches the board. The difference between
  -- this and created_at is the only measure of whether the suggestion
  -- works.
  acted_at    timestamptz
);

-- She asks once per piece, ever. Enforced here rather than by whichever
-- route remembers to check.
create unique index if not exists curator_suggestions_piece_idx
  on public.curator_suggestions (owner_key, piece_id);

-- The 48-hour check: most recent suggestion for this owner, any kind.
create index if not exists curator_suggestions_recent_idx
  on public.curator_suggestions (owner_key, created_at desc);

alter table public.curator_suggestions enable row level security;
