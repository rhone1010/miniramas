-- 024b_feedback_grants.sql
-- Missing grants for the feedback table created in 024.
-- service_role needs full access (the route handler uses supabaseAdmin).
-- authenticated needs insert (for the RLS insert policy to work).

grant all on public.feedback to service_role;
grant insert on public.feedback to authenticated;
grant select on public.feedback_digest to service_role;
