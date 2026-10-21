-- 057: the MY COLLECTION entrance to the shared Product Studio: a Gift session whose favorite is an artwork the customer already owns.
--
-- NOT APPLIED. Requires 047, 048 (and 056 for the approval path). Additive; the only changes to existing objects are two widened CHECK constraints on gift_batches and one new trigger.
--
-- The owned piece (preview_ledger row, portfolio, portfolio item and the stored clean original) is NEVER written, moved or deleted by this migration or by any function in it. A session
-- REFERENCES it: gift_sessions.collection_preview_id (the owned preview_ledger id) and unlock_portfolio_id (the owned portfolio, set at creation so gift_finalize_order / gift_approve_order
-- skip creating a second My Collection piece: they only create one when it is null). The session gets its OWN copies of the files (the clean original as its master, a watermarked view)
-- and its own source photo, and its own batch of kind 'collection' holding exactly one ready preview, which is the selected favorite. Everything after that is the existing Gift flow.
--
--   gift_sessions.collection_preview_id   the owned preview_ledger id this session was started from (null for photo sessions)
--   unique (user_id, collection_preview_id) while the session is active: starting twice returns the same session (idempotent, also under a race)
--   gift_batches.kind                     'free' | 'paid' | 'collection'; a collection batch has exactly one effect (free/paid keep exactly six)
--   trigger                               a session started from the collection can never take a free or paid generation batch (it has nothing to generate)
--   gift_create_collection_session(...)   ownership is checked HERE, in the database, from the ledger row the id names: the row must be unlocked, belong to a portfolio of this user, be a
--                                         finished item of it, and be a portraits / pets / groups piece; anything else answers 'artwork_not_found' (never says whether it exists)
--
-- Service role only; browser roles cannot execute it.

alter table public.gift_sessions add column if not exists collection_preview_id uuid;

create unique index if not exists gift_sessions_collection_unique
  on public.gift_sessions(user_id, collection_preview_id) where collection_preview_id is not null and status = 'active';

-- Widen the two checks that said "free or paid" and "six effects". Found by definition (their generated names are not guaranteed); the pack rule is left alone.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.gift_batches'::regclass and contype = 'c'
              and ((pg_get_constraintdef(oid) ilike '%kind%' and pg_get_constraintdef(oid) ilike '%any%' and pg_get_constraintdef(oid) ilike '%free%')
                   or pg_get_constraintdef(oid) ilike '%cardinality%')
  loop
    execute format('alter table public.gift_batches drop constraint %I', c.conname);
  end loop;
end $$;

do $$ begin
  alter table public.gift_batches add constraint gift_batches_kind_check_057 check (kind in ('free', 'paid', 'collection'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.gift_batches add constraint gift_batches_effects_check_057
    check ((kind = 'collection' and cardinality(effect_ids) = 1) or (kind <> 'collection' and cardinality(effect_ids) = 6));
exception when duplicate_object then null; end $$;

create or replace function public.gift_batches_no_generation_for_collection() returns trigger language plpgsql as $$
begin
  if new.kind <> 'collection' and exists (select 1 from public.gift_sessions s where s.id = new.session_id and s.collection_preview_id is not null) then
    raise exception 'collection_session_no_generation';
  end if;
  return new;
end $$;
drop trigger if exists gift_batches_no_generation_for_collection on public.gift_batches;
create trigger gift_batches_no_generation_for_collection before insert on public.gift_batches for each row execute function public.gift_batches_no_generation_for_collection();

create or replace function public.gift_create_collection_session(
  p_user uuid, p_owned_preview uuid, p_session uuid, p_batch uuid, p_gpreview uuid,
  p_source_path text, p_source_sha text, p_source_w int, p_source_h int, p_analysis jsonb, p_master_aspect text, p_expires timestamptz,
  p_master_path text, p_preview_path text, p_w int, p_h int)
returns table (o_session uuid, o_created boolean)
language plpgsql security definer set search_path = public as $$
declare led record; pf record; it record; pf_id uuid; item_slot int; existing uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('gift_collection:' || p_user::text || ':' || p_owned_preview::text, 0));

  select id, email, storage_path, unlocked_at into led from public.preview_ledger where id = p_owned_preview;
  if not found or led.unlocked_at is null or led.storage_path is null or led.email is null or led.email !~ '^portfolio:[0-9a-f-]{36}:[0-9]+$' then raise exception 'artwork_not_found'; end if;
  pf_id := substring(led.email from 11 for 36)::uuid; item_slot := split_part(led.email, ':', 3)::int;
  select id, series, user_id into pf from public.portfolios where id = pf_id;
  if not found or pf.user_id is distinct from p_user then raise exception 'artwork_not_found'; end if;
  select preset, status into it from public.portfolio_items where portfolio_id = pf.id and preview_id = p_owned_preview and slot = item_slot;
  if not found or it.status <> 'done' then raise exception 'artwork_not_found'; end if;
  if pf.series is null or pf.series not in ('portraits', 'pets', 'groups') then raise exception 'artwork_not_compatible'; end if;

  select s.id into existing from public.gift_sessions s where s.user_id = p_user and s.collection_preview_id = p_owned_preview and s.status = 'active' limit 1;
  if found then return query select existing, false; return; end if;

  insert into public.gift_sessions(id, user_id, status, source_path, source_sha256, source_width, source_height, series, analysis, lines, master_aspect, expires_at, unlock_portfolio_id, collection_preview_id)
    values (p_session, p_user, 'active', p_source_path, p_source_sha, p_source_w, p_source_h, pf.series, coalesce(p_analysis, '{}'::jsonb), '[]'::jsonb, p_master_aspect, p_expires, pf.id, p_owned_preview);
  insert into public.gift_batches(id, session_id, user_id, batch_index, kind, pack_id, idempotency_key, effect_ids)
    values (p_batch, p_session, p_user, 1, 'collection', null, 'collection:' || p_owned_preview::text, array[it.preset]);
  insert into public.gift_previews(id, batch_id, session_id, slot, effect_id, status, attempts, master_path, preview_path, width, height)
    values (p_gpreview, p_batch, p_session, 1, it.preset, 'ready', 0, p_master_path, p_preview_path, p_w, p_h);
  update public.gift_sessions set artwork_preview_id = p_gpreview where id = p_session;
  return query select p_session, true;
end $$;

revoke all on function public.gift_create_collection_session(uuid, uuid, uuid, uuid, uuid, text, text, int, int, jsonb, text, timestamptz, text, text, int, int) from public, anon, authenticated;
grant execute on function public.gift_create_collection_session(uuid, uuid, uuid, uuid, uuid, text, text, int, int, jsonb, text, timestamptz, text, text, int, int) to service_role;
