-- =============================================================================
-- Topsqill PRODUCTION Supabase schema repair — MANUAL REVIEW ONLY
-- =============================================================================
-- DO NOT run via supabase db push / migration repair / Nest APPLY_SCHEMA.
-- DO NOT execute until preflight results are reviewed and approved.
-- This package does NOT modify schema_migrations / supabase_migrations.schema_migrations.
-- Sources: repository migrations listed in each section header.
-- No DROP TABLE, TRUNCATE, or Dev→Prod data copy.
-- =============================================================================

-- FILE: 01_preflight_read_only.sql
-- Purpose: inventory Production before any DDL. Intended as read-only checks.
-- Prefer running statement groups one-at-a-time in Supabase SQL Editor.
-- NOTE: Some SELECTs assume optional tables; wrap with existence checks where noted.
-- This script does not CREATE/ALTER/DROP/GRANT (except it never writes).
-- Sources: N/A (inspection only). Does not touch schema_migrations rows.

-- -----------------------------------------------------------------------------
-- A) Migration history for VIS/ITAM-related versions
-- -----------------------------------------------------------------------------
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260930%'
   OR version LIKE '20261010%'
   OR version LIKE '20261012%'
   OR version LIKE '20261017%'
ORDER BY version;

-- -----------------------------------------------------------------------------
-- B) Dependency tables required by ITAM Phase A FKs / helpers
-- -----------------------------------------------------------------------------
SELECT need.rel AS required_relation,
       to_regclass('public.' || need.rel) AS regclass,
       CASE WHEN to_regclass('public.' || need.rel) IS NULL THEN 'MISSING' ELSE 'PRESENT' END AS status
FROM (VALUES
  ('organizations'),
  ('user_profiles'),
  ('user_organizations'),
  ('it_assets'),
  ('asset_software')
) AS need(rel)
ORDER BY 1;

-- -----------------------------------------------------------------------------
-- C) VIS relations
-- -----------------------------------------------------------------------------
SELECT need.rel AS required_relation,
       to_regclass('public.' || need.rel) AS regclass,
       CASE WHEN to_regclass('public.' || need.rel) IS NULL THEN 'MISSING' ELSE 'PRESENT' END AS status
FROM (VALUES
  ('vis_documents'),
  ('vis_secret_blobs'),
  ('vis_user_refs'),
  ('vis_credential_references'),
  ('vis_connections'),
  ('vis_integrations'),
  ('vis_integration_versions')
) AS need(rel)
ORDER BY 1;

-- -----------------------------------------------------------------------------
-- D) vis_documents columns (run only if table PRESENT)
-- -----------------------------------------------------------------------------
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vis_documents'
ORDER BY ordinal_position;

-- -----------------------------------------------------------------------------
-- E) ITAM Phase A relations (Nest REQUIRED_DISCOVERY_RELATIONS)
-- -----------------------------------------------------------------------------
SELECT need.rel AS required_relation,
       to_regclass('public.' || need.rel) AS regclass,
       CASE WHEN to_regclass('public.' || need.rel) IS NULL THEN 'MISSING' ELSE 'PRESENT' END AS status
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

-- -----------------------------------------------------------------------------
-- F) Helper functions
-- -----------------------------------------------------------------------------
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'INVOKER' END AS security
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_current_user_org_id', 'is_org_admin_of', 'is_current_org_admin')
ORDER BY 1, 2;

-- -----------------------------------------------------------------------------
-- G) Discovery enums
-- -----------------------------------------------------------------------------
SELECT t.typname
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typname IN (
    'discovery_job_status', 'discovery_mode', 'network_scope_auth_status',
    'discovered_asset_status', 'discovery_confidence', 'inventory_source'
  )
ORDER BY 1;

-- -----------------------------------------------------------------------------
-- H) Critical indexes
-- -----------------------------------------------------------------------------
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname IN (
      'uq_asset_software_asset_name_ver',
      'uq_itam_network_scopes_org_cidr_kind',
      'vis_documents_collection_logical_id_uidx',
      'vis_documents_logical_id_idx',
      'vis_documents_collection_idx',
      'vis_documents_collection_created_idx'
    )
    OR tablename LIKE 'itam_%'
    OR tablename LIKE 'vis_%'
  )
ORDER BY tablename, indexname;

-- -----------------------------------------------------------------------------
-- I) asset_software true unique collisions (Postgres UNIQUE NULL semantics)
--     Skip manually if asset_software is MISSING.
-- -----------------------------------------------------------------------------
SELECT asset_id, software_name, version, count(*) AS row_count,
       array_agg(id::text ORDER BY id) AS ids
FROM public.asset_software
GROUP BY asset_id, software_name, version
HAVING count(*) > 1 AND version IS NOT NULL;

-- -----------------------------------------------------------------------------
-- J) itam_network_scopes collisions — skip if table MISSING
-- -----------------------------------------------------------------------------
SELECT organization_id, cidr, scope_kind, count(*) AS row_count,
       array_agg(id::text ORDER BY id) AS ids
FROM public.itam_network_scopes
GROUP BY organization_id, cidr, scope_kind
HAVING count(*) > 1;

-- -----------------------------------------------------------------------------
-- K) VIS table grants (anon / authenticated / service_role)
-- -----------------------------------------------------------------------------
SELECT grantee, table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('vis_documents', 'vis_secret_blobs')
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
GROUP BY grantee, table_name
ORDER BY table_name, grantee;

-- -----------------------------------------------------------------------------
-- L) RLS flags for ITAM tables
-- -----------------------------------------------------------------------------
SELECT c.relname, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname LIKE 'itam_%'
ORDER BY c.relname;

-- -----------------------------------------------------------------------------
-- M) Existing ITAM policies
-- -----------------------------------------------------------------------------
SELECT schemaname, tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'itam_%'
ORDER BY tablename, policyname;

-- -----------------------------------------------------------------------------
-- N) History vs reality (conflict detector)
-- -----------------------------------------------------------------------------
SELECT
  EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20260930120000'
  ) AS history_has_120000,
  (to_regclass('public.itam_network_scopes') IS NOT NULL) AS itam_network_scopes_exists,
  EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261010090000'
  ) AS history_has_vis_100900,
  (to_regclass('public.vis_documents') IS NOT NULL) AS vis_documents_exists,
  EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261012062100'
  ) AS history_has_vis_logical_id,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vis_documents' AND column_name = 'logical_id'
  ) AS vis_documents_has_logical_id;
