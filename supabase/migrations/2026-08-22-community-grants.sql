-- 2026-08-22-community-grants.sql
-- CUI V32. Written for Rich to review and apply. Not applied by CUI.
--
-- WHY: every community table shows service_role holding only REFERENCES,
-- TRIGGER and TRUNCATE - no SELECT, INSERT, UPDATE or DELETE. The routes
-- hold the service key, so every write to any of them is refused.
--
--   [community/handle] upsert failed: permission denied for table
--   community_handles
--
-- This is what a table created by hand in the SQL editor looks like:
-- Supabase's default grants are applied to tables it creates, and not to
-- tables typed into the editor afterwards. community_posts is in the same
-- state, which is why the board has never taken a post - the handle simply
-- failed first and hid it.
--
-- ANON AND AUTHENTICATED ARE LEFT ALONE, DELIBERATELY. Nothing on the glass
-- reads these tables directly; it all goes through routes holding the
-- service key. Granting the browser roles here would open a table of names
-- and owner keys to anybody holding the anon key.

begin;

grant select, insert, update, delete
  on public.community_posts   to service_role;

grant select, insert, update, delete
  on public.community_hearts  to service_role;

grant select, insert, update, delete
  on public.community_reports to service_role;

grant select, insert, update, delete
  on public.community_handles to service_role;

commit;

-- ── DOWN ─────────────────────────────────────────────────────────────────
-- revoke select, insert, update, delete on public.community_posts   from service_role;
-- revoke select, insert, update, delete on public.community_hearts  from service_role;
-- revoke select, insert, update, delete on public.community_reports from service_role;
-- revoke select, insert, update, delete on public.community_handles from service_role;
