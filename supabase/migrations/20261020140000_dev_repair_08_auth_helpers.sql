-- =============================================================================
-- DEV REPAIR 08 — Restore auth/org helpers required by Reports, Dashboards,
-- and Access Control RLS (missing or divergent on Dev).
--
-- Known Dev gaps:
--   * user_has_any_role_assignment(uuid) missing (required by 20260804120000)
--   * get_current_user_organization_id() missing; Dev has get_current_user_org_id()
--   * Related role-permission helpers may be absent if later migrations never applied
--
-- Semantics preserved from repo history — no USING(true) shortcuts.
-- Dev-only. Do NOT apply to Production without separate review.
-- Do NOT run from application startup.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Organization identity helpers
-- ---------------------------------------------------------------------------
-- Canonical short name (ITAM / 20260930110000). Safe idempotent replace.
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.user_profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_current_user_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_org_id() TO authenticated, service_role;

-- Historical long name used by many older policies. Alias body to org_id helper.
CREATE OR REPLACE FUNCTION public.get_current_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_current_user_org_id();
$$;

REVOKE ALL ON FUNCTION public.get_current_user_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_organization_id() TO authenticated, service_role;

-- Org admin of a specific org (may already exist from 20260930110000 / 20260519)
CREATE OR REPLACE FUNCTION public.is_org_admin_of(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _org_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND organization_id = _org_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = _org_id
        AND role = 'admin'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_org_admin_of(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_admin_of(uuid) TO authenticated, service_role;

-- Historical name used by older policies (smtp etc.)
CREATE OR REPLACE FUNCTION public.is_current_user_admin_of_org(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_org_admin_of(_org_id);
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin_of_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin_of_org(uuid) TO authenticated, service_role;

-- Project membership (used by report_media and other scoped policies)
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_users
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated, service_role;

-- can_view_project — final body from 20260804120000 (Dev already has a variant;
-- replace to match create-helper expectations including org admin + permissions)
CREATE OR REPLACE FUNCTION public.can_view_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = _project_id AND pu.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_permissions pp
    WHERE pp.project_id = _project_id AND pp.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND p.created_by = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.user_profiles up ON up.organization_id = p.organization_id
    WHERE p.id = _project_id
      AND up.id = _user_id
      AND up.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Role-assignment helpers (source: 20260521123035)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_any_role_assignment(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_any_role_assignment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_any_role_assignment(uuid) TO authenticated, service_role;

-- Access-control recursion breakers (source: 20260521062531)
CREATE OR REPLACE FUNCTION public.user_has_role_assignment(_user_id uuid, _role_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments
    WHERE user_id = _user_id AND role_id = _role_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of_role(_role_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.roles r
    JOIN public.user_profiles up ON up.organization_id = r.organization_id
    WHERE r.id = _role_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_role_assignment(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_of_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_role_assignment(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_of_role(uuid) TO authenticated, service_role;

-- Group helpers (source: 20260521070943)
CREATE OR REPLACE FUNCTION public.is_admin_of_group(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    JOIN public.user_profiles up ON up.organization_id = g.organization_id
    WHERE g.id = _group_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_group(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    JOIN public.user_profiles up ON up.organization_id = g.organization_id
    WHERE g.id = _group_id
      AND up.id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_of_group(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_group(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_of_group(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_group(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Report / dashboard / policy / workflow role-permission helpers
-- Prefer 20260521121432 bodies (project-scoped OR resource-scoped grants).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_report_role_permission(
  _report_id uuid, _user_id uuid, _permission_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.reports r
    JOIN public.user_role_assignments ura ON ura.user_id = _user_id
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    WHERE r.id = _report_id
      AND rp.permission_type = _permission_type
      AND (
        (rp.resource_type = 'report' AND rp.resource_id = r.id)
        OR (rp.resource_type = 'project' AND rp.resource_id = r.project_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_dashboard_role_permission(
  _dashboard_id uuid, _user_id uuid, _permission_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dashboards d
    JOIN public.user_role_assignments ura ON ura.user_id = _user_id
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    WHERE d.id = _dashboard_id
      AND rp.permission_type = _permission_type
      AND (
        (rp.resource_type = 'dashboard' AND rp.resource_id = d.id)
        OR (rp.resource_type = 'project' AND rp.resource_id = d.project_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_project_report_role_permissions(
  _project_id uuid, _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    WHERE ura.user_id = _user_id
      AND (
        (rp.resource_type = 'project' AND rp.resource_id = _project_id)
        OR (rp.resource_type = 'report' AND rp.resource_id IS NULL)
        OR (
          rp.resource_type = 'report'
          AND EXISTS (
            SELECT 1 FROM public.reports r
            WHERE r.id = rp.resource_id AND r.project_id = _project_id
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_project_dashboard_role_permissions(
  _project_id uuid, _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    WHERE ura.user_id = _user_id
      AND (
        (rp.resource_type = 'project' AND rp.resource_id = _project_id)
        OR (rp.resource_type = 'dashboard' AND rp.resource_id IS NULL)
        OR (
          rp.resource_type = 'dashboard'
          AND EXISTS (
            SELECT 1 FROM public.dashboards d
            WHERE d.id = rp.resource_id AND d.project_id = _project_id
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_policy_role_permission(
  _policy_id uuid, _user_id uuid, _permission_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.policies p
    JOIN public.user_role_assignments ura ON ura.user_id = _user_id
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    WHERE p.id = _policy_id
      AND rp.permission_type = _permission_type
      AND (
        (rp.resource_type = 'policy' AND rp.resource_id = p.id)
        OR (rp.resource_type = 'project' AND rp.resource_id = p.project_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_project_policy_role_permissions(
  _project_id uuid, _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    WHERE ura.user_id = _user_id
      AND (
        (rp.resource_type = 'project' AND rp.resource_id = _project_id)
        OR (rp.resource_type = 'policy' AND rp.resource_id IS NULL)
        OR (
          rp.resource_type = 'policy'
          AND EXISTS (
            SELECT 1 FROM public.policies p
            WHERE p.id = rp.resource_id AND p.project_id = _project_id
          )
        )
      )
  );
$$;

-- Grant execute on role-permission helpers
GRANT EXECUTE ON FUNCTION public.user_has_report_role_permission(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_dashboard_role_permission(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_project_report_role_permissions(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_project_dashboard_role_permissions(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_policy_role_permission(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_project_policy_role_permissions(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Analytics create helpers (source: 20260804120000) — uses user_has_any_role_assignment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_can_create_analytics_in_project(
  _project_id uuid,
  _user_id uuid,
  _resource_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.user_profiles up ON up.organization_id = p.organization_id
      WHERE p.id = _project_id
        AND up.id = _user_id
        AND up.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = _project_id AND p.created_by = _user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.project_users pu
      WHERE pu.project_id = _project_id
        AND pu.user_id = _user_id
        AND pu.role IN ('admin', 'editor')
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      WHERE ura.user_id = _user_id
        AND rp.permission_type = 'create'
        AND (
          (rp.resource_type = _resource_type AND rp.resource_id IS NULL)
          OR (rp.resource_type = 'dashboard' AND _resource_type = 'report' AND rp.resource_id IS NULL)
          OR (rp.resource_type = 'project' AND rp.resource_id = _project_id)
        )
    )
    OR (
      public.can_view_project(_project_id, _user_id)
      AND NOT public.user_has_any_role_assignment(_user_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_create_dashboard_in_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_can_create_analytics_in_project(_project_id, _user_id, 'dashboard');
$$;

CREATE OR REPLACE FUNCTION public.user_can_create_report_in_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_can_create_analytics_in_project(_project_id, _user_id, 'report');
$$;

REVOKE ALL ON FUNCTION public.user_can_create_analytics_in_project(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_create_dashboard_in_project(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_create_report_in_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_create_analytics_in_project(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_create_dashboard_in_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_create_report_in_project(uuid, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
