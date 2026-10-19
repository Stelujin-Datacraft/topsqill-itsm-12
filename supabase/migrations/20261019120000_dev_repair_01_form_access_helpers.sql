-- =============================================================================
-- DEV REPAIR 01 — Restore verified form access helper functions
-- Source of truth: existing supabase/migrations (final CREATE OR REPLACE bodies).
-- Do NOT invent function bodies. Do NOT apply to Production from this procedure.
-- Idempotent: CREATE OR REPLACE + GRANT.
-- Review correction: fail fast if required tables are missing (incl. record_delegations).
-- =============================================================================

BEGIN;

-- Required tables for helper bodies / later RLS (preflight — Dev must already have these).
DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'forms',
    'form_fields',
    'form_submissions',
    'form_audit_logs',
    'user_profiles',
    'project_users',
    'projects',
    'project_permissions',
    'user_role_assignments',
    'role_permissions',
    'project_invitations',
    'record_delegations'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      missing := array_append(missing, t);
    END IF;
  END LOOP;

  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'Dev repair 01 preflight failed — missing public tables: %. Apply prior migrations (esp. record_delegations 20260603095218) before this repair.',
      array_to_string(missing, ', ');
  END IF;
END $$;

-- Prerequisite for can_act_for (final body expects this column).
ALTER TABLE public.record_delegations
  ADD COLUMN IF NOT EXISTS grant_delegator_access boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- can_view_project — final: 20260804120000_fix_reports_dashboard_create_policies.sql
-- Required by can_act_for.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- can_access_form / can_modify_form — final: 20260218042224_…
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_form(_form_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM forms f
    WHERE f.id = _form_id
    AND (
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = _user_id AND up.role = 'admin' AND up.organization_id = f.organization_id
      )
      OR EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = _user_id AND up.organization_id = f.organization_id
      )
      OR EXISTS (
        SELECT 1 FROM project_users pu
        WHERE pu.project_id = f.project_id AND pu.user_id = _user_id
      )
      OR f.created_by = (SELECT up.email FROM user_profiles up WHERE up.id = _user_id)
      OR f.created_by = _user_id::text
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_modify_form(_form_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM forms f
    WHERE f.id = _form_id
    AND (
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = _user_id AND up.role = 'admin' AND up.organization_id = f.organization_id
      )
      OR EXISTS (
        SELECT 1 FROM project_users pu
        WHERE pu.project_id = f.project_id AND pu.user_id = _user_id AND pu.role IN ('admin', 'editor')
      )
      OR f.created_by = (SELECT up.email FROM user_profiles up WHERE up.id = _user_id)
      OR f.created_by = _user_id::text
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- can_modify_forms_row — final: 20260218044247_… (never rewritten later)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_modify_forms_row(_org_id uuid, _created_by text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    EXISTS (SELECT 1 FROM user_profiles WHERE id = _user_id AND role = 'admin' AND organization_id = _org_id)
    OR _created_by = _user_id::text;
$$;

-- ---------------------------------------------------------------------------
-- Role-permission helpers + can_access_forms_row — final: 20260520071315_…
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_form_role_permission(
  _form_id uuid,
  _user_id uuid,
  _permission text DEFAULT 'read'
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    WHERE ura.user_id = _user_id
      AND rp.resource_type = 'form'
      AND (rp.resource_id IS NULL OR rp.resource_id = _form_id)
      AND rp.permission_type = _permission
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_project_form_role_permissions(
  _project_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    LEFT JOIN public.forms f ON f.id = rp.resource_id
    WHERE ura.user_id = _user_id
      AND rp.resource_type = 'form'
      AND (
        rp.resource_id IS NULL
        OR f.project_id = _project_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_forms_row(
  _org_id uuid,
  _project_id uuid,
  _created_by text,
  _is_public boolean,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = _user_id
        AND role = 'admin'
        AND organization_id = _org_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_users
      WHERE project_id = _project_id
        AND user_id = _user_id
        AND role = 'admin'
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.project_users
        WHERE project_id = _project_id
          AND user_id = _user_id
      )
      AND NOT public.user_has_project_form_role_permissions(_project_id, _user_id)
    )
    OR _created_by = _user_id::text
    OR _is_public = true;
$$;

-- ---------------------------------------------------------------------------
-- Delegation helpers — finals: 20260604113932 (can_act_for), 20260606041529
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_act_for(
  _delegator uuid,
  _form_id uuid DEFAULT NULL::uuid,
  _project_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.record_delegations d
    WHERE d.delegate_user_id = auth.uid()
      AND d.delegator_user_id = _delegator
      AND d.active = true
      AND now() BETWEEN d.starts_at AND d.ends_at
      AND (
        d.scope = 'all'
        OR (
          d.scope = 'form'
          AND _form_id IS NOT NULL
          AND d.scope_form_id = _form_id
          AND (d.grant_delegator_access OR public.can_access_form(_form_id, auth.uid()))
        )
        OR (
          d.scope = 'project'
          AND _project_id IS NOT NULL
          AND d.scope_project_id = _project_id
          AND (d.grant_delegator_access OR public.can_view_project(_project_id, auth.uid()))
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_act_for_submission(_delegator uuid, _submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.record_delegations d
    JOIN public.form_submissions s ON s.id = _submission_id
    WHERE d.delegate_user_id = auth.uid()
      AND d.delegator_user_id = _delegator
      AND d.active = true
      AND d.scope::text = 'submission'
      AND d.scope_submission_id = _submission_id
      AND now() BETWEEN d.starts_at AND d.ends_at
      AND (
        d.grant_delegator_access
        OR public.can_access_form(s.form_id, auth.uid())
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Grants (original creates often omitted these; required for PostgREST/RLS use)
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_form(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_modify_form(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_modify_forms_row(uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_form_role_permission(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_project_form_role_permissions(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_forms_row(uuid, uuid, text, boolean, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_act_for(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_act_for_submission(uuid, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
