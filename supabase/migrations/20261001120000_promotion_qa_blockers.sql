-- ============================================================
-- Promotion QA blockers: logical keys, field keys, credentials,
-- and promotion import audit tables.
-- Apply on each environment via migrations (never DB clone).
-- ============================================================

-- 1) Role permissions: portable resource identity
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS resource_logical_key TEXT;

CREATE INDEX IF NOT EXISTS idx_role_permissions_resource_logical_key
  ON public.role_permissions (resource_type, resource_logical_key)
  WHERE resource_logical_key IS NOT NULL;

COMMENT ON COLUMN public.role_permissions.resource_logical_key IS
  'Portable resource identity (e.g. grc.risk). resource_id is environment-local UUID resolved at import/runtime.';

-- Backfill resource_logical_key from target tables' logical_key/reference_id when possible
UPDATE public.role_permissions rp
SET resource_logical_key = lower(trim(f.logical_key))
FROM public.forms f
WHERE rp.resource_type = 'form'
  AND rp.resource_id IS NOT NULL
  AND rp.resource_logical_key IS NULL
  AND f.id::text = rp.resource_id
  AND f.logical_key IS NOT NULL;

UPDATE public.role_permissions rp
SET resource_logical_key = lower(trim(COALESCE(f.logical_key, f.reference_id)))
FROM public.forms f
WHERE rp.resource_type = 'form'
  AND rp.resource_id IS NOT NULL
  AND rp.resource_logical_key IS NULL
  AND f.id::text = rp.resource_id
  AND COALESCE(f.logical_key, f.reference_id) IS NOT NULL;

UPDATE public.role_permissions rp
SET resource_logical_key = lower(trim(COALESCE(w.logical_key, w.reference_id)))
FROM public.workflows w
WHERE rp.resource_type = 'workflow'
  AND rp.resource_id IS NOT NULL
  AND rp.resource_logical_key IS NULL
  AND w.id::text = rp.resource_id
  AND COALESCE(w.logical_key, w.reference_id) IS NOT NULL;

UPDATE public.role_permissions rp
SET resource_logical_key = lower(trim(COALESCE(r.logical_key, r.reference_id)))
FROM public.reports r
WHERE rp.resource_type = 'report'
  AND rp.resource_id IS NOT NULL
  AND rp.resource_logical_key IS NULL
  AND r.id::text = rp.resource_id
  AND COALESCE(r.logical_key, r.reference_id) IS NOT NULL;

UPDATE public.role_permissions rp
SET resource_logical_key = lower(trim(p.logical_key))
FROM public.projects p
WHERE rp.resource_type = 'project'
  AND rp.resource_id IS NOT NULL
  AND rp.resource_logical_key IS NULL
  AND p.id::text = rp.resource_id
  AND p.logical_key IS NOT NULL;

-- 2) Form fields: ensure logical_key (idempotent with prior migration)
ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS logical_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_form_fields_form_logical_key
  ON public.form_fields (form_id, logical_key)
  WHERE logical_key IS NOT NULL AND form_id IS NOT NULL;

-- Deterministic backfill from custom_config.name / custom_config.fieldKey / slug(label)
-- Only when missing; never overwrite existing keys.
UPDATE public.form_fields ff
SET logical_key = lower(regexp_replace(
  regexp_replace(
    COALESCE(
      NULLIF(trim(ff.custom_config->>'fieldKey'), ''),
      NULLIF(trim(ff.custom_config->>'field_key'), ''),
      NULLIF(trim(ff.custom_config->>'name'), ''),
      NULLIF(trim(ff.custom_config->>'key'), ''),
      trim(ff.label)
    ),
    '[^a-zA-Z0-9]+', '-', 'g'
  ),
  '(^-|-$)', '', 'g'
))
WHERE ff.logical_key IS NULL
  AND ff.label IS NOT NULL
  AND length(trim(ff.label)) > 0;

-- Prefix with form logical key / reference_id when available to reduce collisions
UPDATE public.form_fields ff
SET logical_key = lower(trim(COALESCE(f.logical_key, f.reference_id))) || '.' || ff.logical_key
FROM public.forms f
WHERE ff.form_id = f.id
  AND ff.logical_key IS NOT NULL
  AND ff.logical_key NOT LIKE '%.%'
  AND COALESCE(f.logical_key, f.reference_id) IS NOT NULL
  AND length(trim(COALESCE(f.logical_key, f.reference_id))) > 0;

-- Clear accidental empty keys
UPDATE public.form_fields SET logical_key = NULL WHERE logical_key IS NOT NULL AND length(trim(logical_key)) = 0;

-- 3) Connector credential references on data_source_connections (actual Integrations hub storage)
ALTER TABLE public.data_source_connections
  ADD COLUMN IF NOT EXISTS logical_key TEXT;

ALTER TABLE public.data_source_connections
  ADD COLUMN IF NOT EXISTS credential_reference_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_source_connections_org_logical_key
  ON public.data_source_connections (organization_id, logical_key)
  WHERE logical_key IS NOT NULL AND organization_id IS NOT NULL;

COMMENT ON COLUMN public.data_source_connections.credential_reference_id IS
  'SecretProvider reference. http_auth_config must not store secret values after migration.';

-- Optional outbound_connectors table (may not exist on all envs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'outbound_connectors'
  ) THEN
    ALTER TABLE public.outbound_connectors
      ADD COLUMN IF NOT EXISTS logical_key TEXT;
    ALTER TABLE public.outbound_connectors
      ADD COLUMN IF NOT EXISTS credential_reference_id TEXT;
  END IF;
END $$;

-- 4) Platform secret blobs (AES-GCM ciphertext only — never plaintext)
CREATE TABLE IF NOT EXISTS public.platform_secret_blobs (
  ref_id TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'local-encrypted',
  organization_id UUID,
  purpose TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at TIMESTAMPTZ
);

ALTER TABLE public.platform_secret_blobs ENABLE ROW LEVEL SECURITY;

-- Service role / backend only; no authenticated policies for raw ciphertext reads via anon

-- 5) Promotion import audit (real persistence of promotion operations)
CREATE TABLE IF NOT EXISTS public.promotion_import_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_key TEXT NOT NULL,
  package_version TEXT NOT NULL,
  source_environment TEXT NOT NULL DEFAULT 'DEV',
  target_environment TEXT NOT NULL DEFAULT 'DEV',
  target_organization_id UUID,
  target_project_id UUID,
  target_namespace TEXT,
  initiated_by TEXT NOT NULL,
  approved_by TEXT,
  dry_run BOOLEAN NOT NULL DEFAULT true,
  result TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  failures JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotion_import_audits_created
  ON public.promotion_import_audits (created_at DESC);

CREATE TABLE IF NOT EXISTS public.promotion_key_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  component_kind TEXT NOT NULL,
  logical_key TEXT NOT NULL,
  resource_id UUID NOT NULL,
  fingerprint TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, component_kind, logical_key)
);
