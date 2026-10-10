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
