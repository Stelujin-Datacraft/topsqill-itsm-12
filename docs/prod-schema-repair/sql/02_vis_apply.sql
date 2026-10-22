-- =============================================================================
-- Topsqill PRODUCTION Supabase schema repair — MANUAL REVIEW ONLY
-- =============================================================================
-- DO NOT run via supabase db push / migration repair / Nest APPLY_SCHEMA.
-- DO NOT execute until preflight results are reviewed and approved.
-- This package does NOT modify schema_migrations / supabase_migrations.schema_migrations.
-- Sources: repository migrations listed in each section header.
-- No DROP TABLE, TRUNCATE, or Dev→Prod data copy.
-- =============================================================================

-- FILE: 02_vis_apply.sql
-- VIS section only. Run AFTER 01_preflight and approval.
-- Intended order inside this file matches repository migrations:
--   1) 20261010090000_vis_supabase_persistence.sql
--   2) 20261012062100_vis_documents_logical_id.sql
--   3) 20261017130500_vis_revoke_client_table_grants.sql
-- Nest runtime requires: vis_documents (+ logical_id), vis_secret_blobs.
-- Optional typed vis_* tables are included because they are in the authoritative migration.
-- WARNING: logical_id section UPDATES existing vis_documents rows if any exist
--          (backfill + duplicate disambiguation). Empty tables = no row mutation.
-- Not claimed fully idempotent for every statement (e.g. ALTER SET NOT NULL).

-- ========== SOURCE: 20261010090000_vis_supabase_persistence.sql ==========
-- VIS persistence on shared Supabase (replaces separate VIS_DATABASE_URL / Prisma runtime).
-- REVIEWABLE ONLY — do not auto-apply from CI/agents against Dev or Prod.
-- Apply manually to the Development Supabase project first, then Production after validation.
--
-- Runtime SoR used by the Nest VIS module:
--   * vis_documents  — VisStore collections (JSON document store)
--   * vis_secret_blobs — encrypted secret handles for LocalEncryptedSecretProvider
--
-- The remaining vis_* typed tables mirror the former Prisma schema for optional
-- future normalization / reporting. They are created empty and are NOT written
-- by the current SupabaseVisStore implementation. Safe to apply: IF NOT EXISTS /
-- no drops / no data mutation of existing non-VIS tables.

-- ── Runtime tables (required for Nest VIS boot) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.vis_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS vis_documents_collection_idx
  ON public.vis_documents (collection)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS vis_documents_collection_created_idx
  ON public.vis_documents (collection, created_at)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.vis_secret_blobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_id text NOT NULL UNIQUE,
  ciphertext text NOT NULL,
  provider text NOT NULL DEFAULT 'local-encrypted',
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Optional typed tables (Prisma schema parity; unused by current runtime) ─

CREATE TABLE IF NOT EXISTS public.vis_user_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  tenant_id text,
  organization_id text,
  roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.vis_credential_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text,
  tenant_id text,
  name text NOT NULL,
  type text NOT NULL,
  secret_handle text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.vis_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text,
  name text NOT NULL,
  kind text NOT NULL,
  environment text NOT NULL DEFAULT 'DEV',
  base_url text,
  auth_type text NOT NULL,
  credential_ref_id uuid REFERENCES public.vis_credential_references(id),
  config jsonb,
  allow_private_network boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.vis_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text,
  tenant_id text,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'DRAFT',
  environment text NOT NULL DEFAULT 'DEV',
  prompt_text text,
  current_version_id text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.vis_integration_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.vis_integrations(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  design jsonb,
  directions jsonb,
  ai_proposal jsonb,
  user_changes jsonb,
  event_config jsonb,
  source_fields jsonb,
  source_sample jsonb,
  openapi_discovery jsonb,
  selected_endpoint jsonb,
  final_configuration jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, version)
);

-- Service role used by Nest; RLS policies intentionally omitted here so
-- service_role can manage VIS state. Tighten with org-scoped policies later
-- if anon/authenticated clients must never touch these tables.
COMMENT ON TABLE public.vis_documents IS
  'VIS VisStore document SoR (collection + payload). Managed by Nest with service_role.';
COMMENT ON TABLE public.vis_secret_blobs IS
  'VIS encrypted secret blobs. Never store plaintext. Managed by Nest with service_role.';

-- ========== SOURCE: 20261012062100_vis_documents_logical_id.sql ==========
-- VIS documents: separate PostgreSQL UUID PK from application logical IDs.
-- REVIEWABLE ONLY — do not auto-apply from CI/agents against Dev or Prod.
-- Apply manually to the Development Supabase project first, then Production after validation.
--
-- Background: Nest seeds / addresses rows with logical IDs such as `form-vulnerability`.
-- `vis_documents.id` is uuid, so writing those strings into `id` fails. This migration
-- adds `logical_id` and backfills from payload->>'id' (fallback: id::text).
--
-- Duplicate (collection, logical_id) rows are disambiguated by appending ':' || id::text
-- to non-keeper logical_ids (never deletes records). Keepers prefer non-deleted, then
-- earliest created_at. Review `vis_documents_logical_id_conflicts` if that view is created.

-- ── Column ──────────────────────────────────────────────────────────────────

ALTER TABLE public.vis_documents
  ADD COLUMN IF NOT EXISTS logical_id text;

COMMENT ON COLUMN public.vis_documents.logical_id IS
  'Application-level document id (e.g. form-vulnerability). UUID PK remains in id.';

-- ── Backfill ────────────────────────────────────────────────────────────────

UPDATE public.vis_documents
SET logical_id = COALESCE(NULLIF(btrim(payload->>'id'), ''), id::text)
WHERE logical_id IS NULL
   OR btrim(logical_id) = '';

-- ── Duplicate report (read-only; no deletes) ────────────────────────────────
-- Rows that share (collection, logical_id) before disambiguation. Empty = clean.

CREATE OR REPLACE VIEW public.vis_documents_logical_id_conflicts AS
SELECT
  collection,
  logical_id,
  count(*) AS row_count,
  array_agg(id ORDER BY created_at, id) AS document_ids,
  count(*) FILTER (WHERE deleted_at IS NULL) AS active_count
FROM public.vis_documents
WHERE logical_id IS NOT NULL
GROUP BY collection, logical_id
HAVING count(*) > 1;

COMMENT ON VIEW public.vis_documents_logical_id_conflicts IS
  'Pre/post-migration duplicate (collection, logical_id) groups. Inspect before/after apply; never auto-delete.';

-- ── Disambiguate duplicates without deleting ───────────────────────────────
-- Keep one row per (collection, logical_id): prefer active (deleted_at IS NULL),
-- then earliest created_at, then id. Non-keepers get logical_id || ':' || id::text
-- so a unique index can be created safely. Manual review may still remount
-- integrations onto the keeper logical_id if a conflict existed in Dev.

WITH ranked AS (
  SELECT
    id,
    collection,
    logical_id,
    ROW_NUMBER() OVER (
      PARTITION BY collection, logical_id
      ORDER BY (deleted_at IS NULL) DESC, created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.vis_documents
  WHERE logical_id IS NOT NULL
)
UPDATE public.vis_documents d
SET
  logical_id = d.logical_id || ':' || d.id::text,
  payload = jsonb_set(
    COALESCE(d.payload, '{}'::jsonb),
    '{id}',
    to_jsonb(d.logical_id || ':' || d.id::text),
    true
  ),
  updated_at = now()
FROM ranked r
WHERE d.id = r.id
  AND r.rn > 1;

-- ── Enforce NOT NULL + unique (collection, logical_id) ──────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.vis_documents WHERE logical_id IS NULL OR btrim(logical_id) = ''
  ) THEN
    RAISE EXCEPTION
      'vis_documents.logical_id backfill left NULL/blank rows; aborting unique index create';
  END IF;
END $$;

ALTER TABLE public.vis_documents
  ALTER COLUMN logical_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vis_documents_collection_logical_id_uidx
  ON public.vis_documents (collection, logical_id);

CREATE INDEX IF NOT EXISTS vis_documents_logical_id_idx
  ON public.vis_documents (logical_id)
  WHERE deleted_at IS NULL;

-- ========== SOURCE: 20261017130500_vis_revoke_client_table_grants.sql ==========
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
