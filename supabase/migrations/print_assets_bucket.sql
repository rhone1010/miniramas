-- supabase/migrations/print_assets_bucket.sql
--
-- Creates the private 'print-assets' storage bucket used by the print pipeline.
-- Server-side uploads use the service-role key, which bypasses RLS, so no
-- additional policies are needed for the upload path.
--
-- If you prefer the dashboard: Storage → New bucket → name = "print-assets",
-- Public bucket = OFF. That's equivalent.

insert into storage.buckets (id, name, public)
values ('print-assets', 'print-assets', false)
on conflict (id) do nothing;
