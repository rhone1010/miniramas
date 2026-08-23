-- 2026-08-22-community-board-view.sql
-- CUI V32. Written for Rich to review and apply. Not applied by CUI.
--
-- NO begin/commit. The Supabase SQL editor manages its own transaction, and
-- a wrapped GRANT reported success on 22 August without applying. Every
-- migration from here on is bare statements.
--
-- WHY: /api/v1/community/posts reads public.community_board and the view
-- does not exist, so the board reads empty even with live posts in the
-- table.
--
--   [community/posts] read failed: Could not find the table
--   'public.community_board' in the schema cache
--
-- THE VIEW IS THE PRIVACY BOUNDARY, NOT THE ROUTE.
-- The board is readable signed out. owner_key identifies a person and the
-- board must never carry it, so the column is absent from the view rather
-- than merely unselected by the route. A route can be refactored into
-- leaking a column; a view cannot leak one it does not have.
--
-- Columns are exactly what the route selects, in the order it names them:
--   id, effect_id, series, image_path, heart_count, comment_count,
--   handle, created_at

create or replace view public.community_board as
select
  p.id,
  p.effect_id,
  p.series,

  -- image_path DOES belong here. The route signs it and builds image_url by
  -- hand, deliberately never spreading the row, so the path reaches the
  -- signer and never the browser.
  p.image_path,

  p.heart_count,

  -- LITERAL ZERO, ON RULING. Comments are not built and community_comments
  -- does not exist. The route selects this column and the glass renders it,
  -- so it has to be present and has to be a number. When comments are built
  -- this becomes a count and nothing above it changes.
  0::integer as comment_count,

  -- LEFT JOIN, NOT INNER. A post whose author has somehow no handle row
  -- still belongs on the board with a null name under it; an inner join
  -- would make it vanish, which is the harder fault to notice.
  h.handle,

  p.created_at

from public.community_posts p
left join public.community_handles h
  on h.owner_key = p.owner_key

-- Withdrawn and removed posts are off the board. The state check on the
-- table allows live, withdrawn and removed; only the first is public.
where p.state = 'live';

-- security_invoker is OFF by default, so the view runs as its owner and the
-- underlying tables are reached through it. That is what lets the board be
-- read without granting anybody select on community_posts itself.

-- The routes hold the service key. Nothing else reads this.
grant select on public.community_board to service_role;

-- ── VERIFY ───────────────────────────────────────────────────────────────
-- select id, effect_id, series, heart_count, comment_count, handle, created_at
-- from public.community_board order by created_at desc limit 5;

-- ── DOWN ─────────────────────────────────────────────────────────────────
-- drop view if exists public.community_board;
