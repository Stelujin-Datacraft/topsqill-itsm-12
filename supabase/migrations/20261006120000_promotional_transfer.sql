-- Promotional Transfer: packages, items, validation, audit, versions, logical Prod snapshots
-- Admin-only RLS; service role used by Nest promotion engine.

CREATE TABLE IF NOT EXISTS public.promotion_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source_environment TEXT NOT NULL DEFAULT 'TopsqillITSM_Dev',
  target_environment TEXT NOT NULL DEFAULT 'TopsqillITSM_Prod',
  module TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN (
      'Draft', 'Validating', 'Ready', 'Promoting',
      'Completed', 'Failed', 'PartiallyCompleted'
    )),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
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

CREATE INDEX IF NOT EXISTS idx_promotion_packages_created
  ON public.promotion_packages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotion_packages_status
  ON public.promotion_packages (status);
CREATE INDEX IF NOT EXISTS idx_promotion_packages_org
  ON public.promotion_packages (organization_id);

CREATE TABLE IF NOT EXISTS public.promotion_package_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.promotion_packages(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  stable_id TEXT NOT NULL,
  object_name TEXT NOT NULL,
  module TEXT NOT NULL,
  selection_source TEXT NOT NULL DEFAULT 'explicit'
    CHECK (selection_source IN ('explicit', 'dependency')),
  included BOOLEAN NOT NULL DEFAULT true,
  dev_version TEXT,
  prod_version TEXT,
  prod_before_snapshot JSONB,
  prod_after_snapshot JSONB,
  validation_status TEXT
    CHECK (validation_status IS NULL OR validation_status IN ('ready', 'warning', 'conflict', 'skipped')),
  validation_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  execution_status TEXT
    CHECK (execution_status IS NULL OR execution_status IN (
      'pending', 'promoting', 'succeeded', 'failed', 'skipped', 'identical'
    )),
  execution_error TEXT,
  dependency_of TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  portable_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id, object_type, stable_id)
);

CREATE INDEX IF NOT EXISTS idx_promotion_items_package
  ON public.promotion_package_items (package_id);

CREATE TABLE IF NOT EXISTS public.promotion_validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.promotion_packages(id) ON DELETE CASCADE,
  object_type TEXT,
  stable_id TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('ready', 'warning', 'conflict')),
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotion_validation_package
  ON public.promotion_validation_results (package_id);

CREATE TABLE IF NOT EXISTS public.promotion_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES public.promotion_packages(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotion_audit_package
  ON public.promotion_audit_events (package_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotion_audit_created
  ON public.promotion_audit_events (created_at DESC);

CREATE TABLE IF NOT EXISTS public.promotion_object_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type TEXT NOT NULL,
  stable_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  version TEXT NOT NULL,
  content_hash TEXT,
  package_id UUID REFERENCES public.promotion_packages(id) ON DELETE SET NULL,
  promoted_by UUID REFERENCES auth.users(id),
  promoted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (object_type, stable_id, environment, version, promoted_at)
);

CREATE INDEX IF NOT EXISTS idx_promotion_versions_object
  ON public.promotion_object_versions (object_type, stable_id, environment);

-- Logical Prod mirror when dual-DB Prod credentials are not configured
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

CREATE INDEX IF NOT EXISTS idx_promotion_target_snapshots_type
  ON public.promotion_target_snapshots (object_type);

ALTER TABLE public.promotion_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_object_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_target_snapshots ENABLE ROW LEVEL SECURITY;

-- Admin-only policies (Nest uses service role; policies protect direct client access)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_current_user_admin'
  ) THEN
    DROP POLICY IF EXISTS "Admins manage promotion_packages" ON public.promotion_packages;
    CREATE POLICY "Admins manage promotion_packages"
      ON public.promotion_packages FOR ALL TO authenticated
      USING (public.is_current_user_admin())
      WITH CHECK (public.is_current_user_admin());

    DROP POLICY IF EXISTS "Admins manage promotion_package_items" ON public.promotion_package_items;
    CREATE POLICY "Admins manage promotion_package_items"
      ON public.promotion_package_items FOR ALL TO authenticated
      USING (public.is_current_user_admin())
      WITH CHECK (public.is_current_user_admin());

    DROP POLICY IF EXISTS "Admins manage promotion_validation_results" ON public.promotion_validation_results;
    CREATE POLICY "Admins manage promotion_validation_results"
      ON public.promotion_validation_results FOR ALL TO authenticated
      USING (public.is_current_user_admin())
      WITH CHECK (public.is_current_user_admin());

    DROP POLICY IF EXISTS "Admins manage promotion_audit_events" ON public.promotion_audit_events;
    CREATE POLICY "Admins manage promotion_audit_events"
      ON public.promotion_audit_events FOR ALL TO authenticated
      USING (public.is_current_user_admin())
      WITH CHECK (public.is_current_user_admin());

    DROP POLICY IF EXISTS "Admins manage promotion_object_versions" ON public.promotion_object_versions;
    CREATE POLICY "Admins manage promotion_object_versions"
      ON public.promotion_object_versions FOR ALL TO authenticated
      USING (public.is_current_user_admin())
      WITH CHECK (public.is_current_user_admin());

    DROP POLICY IF EXISTS "Admins manage promotion_target_snapshots" ON public.promotion_target_snapshots;
    CREATE POLICY "Admins manage promotion_target_snapshots"
      ON public.promotion_target_snapshots FOR ALL TO authenticated
      USING (public.is_current_user_admin())
      WITH CHECK (public.is_current_user_admin());
  END IF;
END $$;
