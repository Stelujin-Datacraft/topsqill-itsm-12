-- =============================================================================
-- Topsqill PRODUCTION Supabase schema repair — MANUAL REVIEW ONLY
-- =============================================================================
-- DO NOT run via supabase db push / migration repair / Nest APPLY_SCHEMA.
-- DO NOT execute until preflight results are reviewed and approved.
-- This package does NOT modify schema_migrations / supabase_migrations.schema_migrations.
-- Sources: repository migrations listed in each section header.
-- No DROP TABLE, TRUNCATE, or Dev→Prod data copy.
-- =============================================================================

-- FILE: 04_postcheck_verification.sql
-- Run AFTER approved apply scripts. Read-oriented verification of readiness.
-- Does not mutate data (SELECT / catalog only).

-- VIS readiness for Nest SupabaseVisStore
SELECT 'vis_documents' AS obj, to_regclass('public.vis_documents') IS NOT NULL AS ok
UNION ALL
SELECT 'vis_secret_blobs', to_regclass('public.vis_secret_blobs') IS NOT NULL
UNION ALL
SELECT 'vis_documents.logical_id',
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vis_documents'
      AND column_name='logical_id' AND is_nullable='NO'
  )
UNION ALL
SELECT 'vis_documents_collection_logical_id_uidx',
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='vis_documents_collection_logical_id_uidx'
  );

-- VIS privileges: anon/authenticated should have no table privileges
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('vis_documents','vis_secret_blobs')
  AND grantee IN ('anon','authenticated')
ORDER BY 1,2,3;
-- Expect: zero rows (or only non-table grants elsewhere). service_role should have access:

SELECT grantee, table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('vis_documents','vis_secret_blobs')
  AND grantee = 'service_role'
GROUP BY 1,2
ORDER BY 2;

-- ITAM Phase A readiness (Nest REQUIRED_DISCOVERY_RELATIONS)
SELECT need.rel,
       to_regclass('public.' || need.rel) IS NOT NULL AS present
FROM (VALUES
  ('itam_network_scopes'),
  ('itam_discovery_jobs'),
  ('itam_discovery_runs'),
  ('itam_discovered_hosts'),
  ('itam_asset_identities'),
  ('itam_discovery_diffs'),
  ('itam_discovery_audit'),
  ('itam_asset_services'),
  ('itam_field_provenance'),
  ('itam_software_catalog'),
  ('itam_software_aliases')
) AS need(rel)
ORDER BY 1;

-- Unique indexes Nest ON CONFLICT expects
SELECT indexname,
       EXISTS (
         SELECT 1 FROM pg_indexes i
         WHERE i.schemaname='public' AND i.indexname = want.indexname
       ) AS present
FROM (VALUES
  ('uq_asset_software_asset_name_ver'),
  ('uq_itam_network_scopes_org_cidr_kind')
) AS want(indexname);

-- Helpers
SELECT p.proname AS function_name,
       TRUE AS present
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('get_current_user_org_id','is_org_admin_of','is_current_org_admin');

-- RLS enabled on Phase A tables
SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN (
    'itam_network_scopes','itam_discovery_jobs','itam_discovery_runs',
    'itam_discovered_hosts','itam_asset_identities','itam_software_catalog',
    'itam_software_aliases','itam_discovery_diffs','itam_discovery_audit',
    'itam_asset_services','itam_field_provenance'
  )
ORDER BY 1;

-- Expect SELECT + admin write policies (spot-check): no FOR ALL loose org-only policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN (
    'itam_network_scopes','itam_discovery_jobs','itam_discovery_audit'
  )
ORDER BY tablename, policyname;

-- Append-only audit: no UPDATE/DELETE policies for authenticated
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname='public'
  AND tablename = 'itam_discovery_audit'
  AND cmd IN ('UPDATE','DELETE','ALL');
-- Expect: zero rows
