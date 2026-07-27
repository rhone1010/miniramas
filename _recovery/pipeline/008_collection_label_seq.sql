-- 008_collection_label_seq.sql
-- Account-wide, monotonic piece-number sequence for auto-generated labels
-- (auto-naming supersession, 2026-07-23). Labels are generated at persist time as
--   [Series] - [Effect] - [User Name] - [###]
-- where [###] is a zero-padded, account-wide, monotonic counter starting at 001.
-- Per-owner (owner_key) so a signed-in user's numbering is unique across the account
-- and does NOT renumber when a piece is deleted (the number is assigned once, stored
-- in collection_pieces.label).

create table if not exists collection_label_seq (
  owner_key text primary key,   -- auth user id OR guest token (mirrors collection_pieces)
  next_seq  int  not null default 1
);

alter table collection_label_seq enable row level security;
-- No policies: service-role only, same posture as collection_pieces / craft_events.

-- Atomic assign-then-advance. Single statement → race-safe under the parallel
-- persists a batch craft produces. Returns the number to ASSIGN (starts at 1).
create or replace function next_label_seq(p_owner text)
returns int
language plpgsql
as $$
declare assigned int;
begin
  insert into collection_label_seq (owner_key, next_seq)
    values (p_owner, 2)
  on conflict (owner_key)
    do update set next_seq = collection_label_seq.next_seq + 1
  returning next_seq - 1 into assigned;
  return assigned;
end;
$$;
