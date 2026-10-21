-- VIS client privilege lockdown (forward-only).
-- REVIEWABLE ONLY — do not auto-apply from CI/agents against Dev or Prod.
-- Apply after 20261010090000_vis_supabase_persistence.sql (+ logical_id if used).
--
-- Nest VIS uses the Supabase service_role key. anon / authenticated must not
-- hold table privileges on vis_documents or vis_secret_blobs (ciphertext).
-- This migration does NOT alter data, does NOT disable RLS, and does NOT DROP
-- tables. REVOKE / GRANT are idempotent and safe to re-run.

REVOKE ALL ON TABLE public.vis_documents FROM anon;
REVOKE ALL ON TABLE public.vis_documents FROM authenticated;

REVOKE ALL ON TABLE public.vis_secret_blobs FROM anon;
REVOKE ALL ON TABLE public.vis_secret_blobs FROM authenticated;

-- Keep Nest / service_role access explicit (idempotent).
GRANT ALL ON TABLE public.vis_documents TO service_role;
GRANT ALL ON TABLE public.vis_secret_blobs TO service_role;
