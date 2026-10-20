-- =============================================================================
-- DEV REPAIR 09 — Restore Reports & Dashboards RLS, then drop known Dev
-- RESTRICTIVE deny policies (reports_migration_deny / dashboards_migration_deny).
--
-- Operator inventory: these tables currently have ONLY the deny policies on Dev.
-- Restore intended SELECT/INSERT/UPDATE/DELETE from repo finals BEFORE dropping deny.
-- Depends on helpers from 20261020140000_dev_repair_08_auth_helpers.sql.
--
-- Does NOT touch Forms, workflows, or service-only tables.
-- Dev-only. Do NOT apply to Production without separate review.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'reports'
  ) THEN
    RAISE EXCEPTION 'Dev repair 09 preflight failed — public.reports missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dashboards'
  ) THEN
    RAISE EXCEPTION 'Dev repair 09 preflight failed — public.dashboards missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'user_has_any_role_assignment'
  ) THEN
    RAISE EXCEPTION
      'Dev repair 09 preflight failed — user_has_any_role_assignment missing. Apply repair 08 first.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'user_can_create_analytics_in_project'
  ) THEN
    RAISE EXCEPTION
      'Dev repair 09 preflight failed — user_can_create_analytics_in_project missing. Apply repair 08 first.';
  END IF;
END $$;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- REPORTS — SELECT (20260520081641 project-scoped legacy path)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view reports in their organization" ON public.reports;
CREATE POLICY "Users can view reports in their organization"
ON public.reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = reports.organization_id
  )
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = reports.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
  OR public.user_has_report_role_permission(reports.id, auth.uid(), 'read')
  OR (
    organization_id = public.get_current_user_organization_id()
    AND NOT public.user_has_project_report_role_permissions(reports.project_id, auth.uid())
  )
);

-- INSERT (20260804120000)
DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Users can create reports in their organization" ON public.reports;
DROP POLICY IF EXISTS "Role-based users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Authorized users can create reports" ON public.reports;
CREATE POLICY "Authorized users can create reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.user_can_create_analytics_in_project(project_id, auth.uid(), 'report')
);

-- UPDATE / DELETE (20260725120000)
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports"
ON public.reports
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = reports.organization_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = reports.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
  OR created_by = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = reports.organization_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = reports.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "Admins can delete reports" ON public.reports;
CREATE POLICY "Admins can delete reports"
ON public.reports
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = reports.organization_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = reports.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
  OR created_by = auth.uid()
);

-- ---------------------------------------------------------------------------
-- DASHBOARDS — SELECT (20260520081641)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Project members can view dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Users can view dashboards in their projects" ON public.dashboards;
CREATE POLICY "Project members can view dashboards"
ON public.dashboards
FOR SELECT
TO authenticated
USING (
  created_by = (auth.uid())::text
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = dashboards.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
  OR public.user_has_dashboard_role_permission(dashboards.id, auth.uid(), 'read')
  OR (
    EXISTS (
      SELECT 1 FROM public.project_users pu
      WHERE pu.project_id = dashboards.project_id
        AND pu.user_id = auth.uid()
    )
    AND NOT public.user_has_project_dashboard_role_permissions(dashboards.project_id, auth.uid())
  )
);

-- INSERT (20260804120000)
DROP POLICY IF EXISTS "Users can create dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Project members can create dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Role-based users can create dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Authorized users can create dashboards" ON public.dashboards;
CREATE POLICY "Authorized users can create dashboards"
ON public.dashboards
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()::text
  AND public.user_can_create_analytics_in_project(project_id, auth.uid(), 'dashboard')
);

-- UPDATE / DELETE (20260725120000)
DROP POLICY IF EXISTS "Org admins can update dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Users can update their dashboards" ON public.dashboards;
CREATE POLICY "Org admins can update dashboards"
ON public.dashboards
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = dashboards.organization_id
  )
  OR created_by = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = dashboards.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = dashboards.organization_id
  )
  OR created_by = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = dashboards.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Org admins can delete dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Users can delete their dashboards" ON public.dashboards;
CREATE POLICY "Org admins can delete dashboards"
ON public.dashboards
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = dashboards.organization_id
  )
  OR created_by = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = dashboards.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- Drop known Dev RESTRICTIVE deny-all ONLY after scoped policies exist.
-- Exact names from operator inventory — do not drop unrelated *_migration_deny.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "reports_migration_deny" ON public.reports;
DROP POLICY IF EXISTS "dashboards_migration_deny" ON public.dashboards;

NOTIFY pgrst, 'reload schema';

COMMIT;
