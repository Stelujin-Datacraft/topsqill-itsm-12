/** Embedded DDL for promotional transfer tables (idempotent). */
export const PROMOTION_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS public.promotion_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source_environment TEXT NOT NULL DEFAULT 'TopsqillITSM_Dev',
  target_environment TEXT NOT NULL DEFAULT 'TopsqillITSM_Prod',
  module TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  organization_id UUID,
  project_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_at TIMESTAMPTZ,
  execution_started_at TIMESTAMPTZ,
  execution_ended_at TIMESTAMPTZ,
  validation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  promotion_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_details JSONB,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.promotion_package_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.promotion_packages(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  stable_id TEXT NOT NULL,
  object_name TEXT NOT NULL,
  module TEXT NOT NULL,
  selection_source TEXT NOT NULL DEFAULT 'explicit',
  included BOOLEAN NOT NULL DEFAULT true,
  dev_version TEXT,
  prod_version TEXT,
  prod_before_snapshot JSONB,
  prod_after_snapshot JSONB,
  validation_status TEXT,
  validation_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  execution_status TEXT,
  execution_error TEXT,
  dependency_of TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  portable_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id, object_type, stable_id)
);

CREATE TABLE IF NOT EXISTS public.promotion_validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.promotion_packages(id) ON DELETE CASCADE,
  object_type TEXT,
  stable_id TEXT,
  severity TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promotion_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES public.promotion_packages(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  actor_id UUID,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promotion_object_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type TEXT NOT NULL,
  stable_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  version TEXT NOT NULL,
  content_hash TEXT,
  package_id UUID REFERENCES public.promotion_packages(id) ON DELETE SET NULL,
  promoted_by UUID,
  promoted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.promotion_target_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type TEXT NOT NULL,
  stable_id TEXT NOT NULL,
  object_name TEXT NOT NULL,
  version TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  last_package_id UUID REFERENCES public.promotion_packages(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (object_type, stable_id)
);
`;
