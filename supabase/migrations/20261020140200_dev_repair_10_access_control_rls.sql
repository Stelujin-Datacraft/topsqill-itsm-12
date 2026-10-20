-- =============================================================================
-- DEV REPAIR 10 — Restore Access Control (Roles and Access) RLS, then drop
-- known temporary RESTRICTIVE *_migration_deny policies on those tables.
--
-- Access Control tab (RolesAndAccess / CreateRolesTab / UserRolesTab) queries:
--   roles, role_permissions, user_role_assignments, project_top_level_permissions,
--   groups, group_memberships, group_role_assignments
-- Plus reports/dashboards (repaired in 09) for permission pickers.
--
-- Restore org-admin manage + self-view policies from:
--   20250629103337, 20250630132227, 20250701101826, 20260520072353,
--   20260521062531, 20260521070943
-- then drop exact deny names. Do NOT drop projects_migration_deny or
-- service-only / secrets table denies.
--
-- Depends on helpers from repair 08 (is_admin_of_role, can_view_group, …).
-- Dev-only. Do NOT apply to Production without separate review.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'roles', 'role_permissions', 'user_role_assignments',
    'project_top_level_permissions'
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
      'Dev repair 10 preflight failed — missing Access Control tables: %',
      array_to_string(missing, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin_of_role'
  ) THEN
    RAISE EXCEPTION
      'Dev repair 10 preflight failed — is_admin_of_role missing. Apply repair 08 first.';
  END IF;
END $$;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_top_level_permissions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Organization admins can manage roles" ON public.roles;
CREATE POLICY "Organization admins can manage roles"
ON public.roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = roles.organization_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = roles.organization_id
  )
);

DROP POLICY IF EXISTS "Users can view assigned roles" ON public.roles;
CREATE POLICY "Users can view assigned roles"
ON public.roles
FOR SELECT
TO authenticated
USING (public.user_has_role_assignment(auth.uid(), id));

-- ---------------------------------------------------------------------------
-- role_permissions
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Organization admins can manage role permissions" ON public.role_permissions;
CREATE POLICY "Organization admins can manage role permissions"
ON public.role_permissions
FOR ALL
TO authenticated
USING (public.is_admin_of_role(role_id))
WITH CHECK (public.is_admin_of_role(role_id));

DROP POLICY IF EXISTS "Users can view permissions for assigned roles" ON public.role_permissions;
CREATE POLICY "Users can view permissions for assigned roles"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.role_id = role_permissions.role_id
      AND ura.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- user_role_assignments
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Organization admins can manage user role assignments" ON public.user_role_assignments;
CREATE POLICY "Organization admins can manage user role assignments"
ON public.user_role_assignments
FOR ALL
TO authenticated
USING (public.is_admin_of_role(role_id))
WITH CHECK (public.is_admin_of_role(role_id));

DROP POLICY IF EXISTS "Users can view their own role assignments" ON public.user_role_assignments;
CREATE POLICY "Users can view their own role assignments"
ON public.user_role_assignments
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- project_top_level_permissions (useUnifiedAccessControl)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Project admins can manage top-level permissions" ON public.project_top_level_permissions;
CREATE POLICY "Project admins can manage top-level permissions"
ON public.project_top_level_permissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.user_profiles up ON up.id = auth.uid()
    WHERE p.id = project_top_level_permissions.project_id
      AND (
        p.created_by = auth.uid()
        OR (up.role = 'admin' AND up.organization_id = p.organization_id)
        OR EXISTS (
          SELECT 1 FROM public.project_users pu
          WHERE pu.project_id = p.id
            AND pu.user_id = auth.uid()
            AND pu.role = 'admin'
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.user_profiles up ON up.id = auth.uid()
    WHERE p.id = project_top_level_permissions.project_id
      AND (
        p.created_by = auth.uid()
        OR (up.role = 'admin' AND up.organization_id = p.organization_id)
        OR EXISTS (
          SELECT 1 FROM public.project_users pu
          WHERE pu.project_id = p.id
            AND pu.user_id = auth.uid()
            AND pu.role = 'admin'
        )
      )
  )
);

DROP POLICY IF EXISTS "Users can view project top-level permissions" ON public.project_top_level_permissions;
CREATE POLICY "Users can view project top-level permissions"
ON public.project_top_level_permissions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_top_level_permissions.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_users pu
          WHERE pu.project_id = p.id AND pu.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND up.role = 'admin'
            AND up.organization_id = p.organization_id
        )
      )
  )
);

-- ---------------------------------------------------------------------------
-- groups / memberships / group_role_assignments / group_roles (if present)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'groups'
  ) THEN
    EXECUTE 'ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Organization admins can manage groups" ON public.groups';
    EXECUTE $p$
      CREATE POLICY "Organization admins can manage groups"
      ON public.groups FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND up.role = 'admin'
            AND up.organization_id = groups.organization_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND up.role = 'admin'
            AND up.organization_id = groups.organization_id
        )
      )
    $p$;
    -- Org members can view groups in their org (GroupRolesTab listing)
    EXECUTE 'DROP POLICY IF EXISTS "Users can view groups in their org" ON public.groups';
    EXECUTE $p$
      CREATE POLICY "Users can view groups in their org"
      ON public.groups FOR SELECT TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
        )
      )
    $p$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'group_memberships'
  ) THEN
    EXECUTE 'ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Organization admins can manage group memberships" ON public.group_memberships';
    EXECUTE $p$
      CREATE POLICY "Organization admins can manage group memberships"
      ON public.group_memberships FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.groups g
          JOIN public.user_profiles up ON up.organization_id = g.organization_id
          WHERE g.id = group_memberships.group_id
            AND up.id = auth.uid()
            AND up.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.groups g
          JOIN public.user_profiles up ON up.organization_id = g.organization_id
          WHERE g.id = group_memberships.group_id
            AND up.id = auth.uid()
            AND up.role = 'admin'
        )
      )
    $p$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'group_roles'
  ) THEN
    EXECUTE 'ALTER TABLE public.group_roles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Organization admins can manage group roles" ON public.group_roles';
    EXECUTE $p$
      CREATE POLICY "Organization admins can manage group roles"
      ON public.group_roles FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND up.role = 'admin'
            AND up.organization_id = group_roles.organization_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND up.role = 'admin'
            AND up.organization_id = group_roles.organization_id
        )
      )
    $p$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'group_role_assignments'
  ) THEN
    EXECUTE 'ALTER TABLE public.group_role_assignments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view group role assignments in their org" ON public.group_role_assignments';
    EXECUTE $p$
      CREATE POLICY "Users can view group role assignments in their org"
      ON public.group_role_assignments FOR SELECT TO authenticated
      USING (public.can_view_group(group_id))
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage group role assignments" ON public.group_role_assignments';
    EXECUTE $p$
      CREATE POLICY "Admins can manage group role assignments"
      ON public.group_role_assignments FOR ALL TO authenticated
      USING (public.is_admin_of_group(group_id))
      WITH CHECK (public.is_admin_of_group(group_id))
    $p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Security templates / parameters (Users / Access Control open path)
-- Source: 20260116091414 + 20260116090207
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'security_templates'
  ) THEN
    EXECUTE 'ALTER TABLE public.security_templates ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Members can view org security templates" ON public.security_templates';
    EXECUTE $p$
      CREATE POLICY "Members can view org security templates"
      ON public.security_templates FOR SELECT TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
        )
      )
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage security templates" ON public.security_templates';
    EXECUTE $p$
      CREATE POLICY "Admins can manage security templates"
      ON public.security_templates FOR ALL TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
    $p$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_security_parameters'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_security_parameters ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all security parameters in their org" ON public.user_security_parameters';
    EXECUTE $p$
      CREATE POLICY "Admins can view all security parameters in their org"
      ON public.user_security_parameters FOR SELECT TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "Admins can insert security parameters in their org" ON public.user_security_parameters';
    EXECUTE $p$
      CREATE POLICY "Admins can insert security parameters in their org"
      ON public.user_security_parameters FOR INSERT TO authenticated
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "Admins can update security parameters in their org" ON public.user_security_parameters';
    EXECUTE $p$
      CREATE POLICY "Admins can update security parameters in their org"
      ON public.user_security_parameters FOR UPDATE TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete security parameters in their org" ON public.user_security_parameters';
    EXECUTE $p$
      CREATE POLICY "Admins can delete security parameters in their org"
      ON public.user_security_parameters FOR DELETE TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own security parameters" ON public.user_security_parameters';
    EXECUTE $p$
      CREATE POLICY "Users can view their own security parameters"
      ON public.user_security_parameters FOR SELECT TO authenticated
      USING (user_id = auth.uid())
    $p$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_security_defaults'
  ) THEN
    EXECUTE 'ALTER TABLE public.organization_security_defaults ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Members can view org security defaults" ON public.organization_security_defaults';
    EXECUTE $p$
      CREATE POLICY "Members can view org security defaults"
      ON public.organization_security_defaults FOR SELECT TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
        )
      )
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage org security defaults" ON public.organization_security_defaults';
    EXECUTE $p$
      CREATE POLICY "Admins can manage org security defaults"
      ON public.organization_security_defaults FOR ALL TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
    $p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Drop exact known Access Control RESTRICTIVE deny policies AFTER replacements.
-- Do NOT drop projects_migration_deny, smtp/api_keys/secrets denies, etc.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "roles_migration_deny" ON public.roles;
DROP POLICY IF EXISTS "role_permissions_migration_deny" ON public.role_permissions;
DROP POLICY IF EXISTS "user_role_assignments_migration_deny" ON public.user_role_assignments;
DROP POLICY IF EXISTS "project_top_level_permissions_migration_deny" ON public.project_top_level_permissions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'groups'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "groups_migration_deny" ON public.groups';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'group_memberships'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "group_memberships_migration_deny" ON public.group_memberships';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'group_roles'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "group_roles_migration_deny" ON public.group_roles';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'group_role_assignments'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "group_role_assignments_migration_deny" ON public.group_role_assignments';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'security_templates'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "security_templates_migration_deny" ON public.security_templates';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_security_parameters'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "user_security_parameters_migration_deny" ON public.user_security_parameters';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_security_defaults'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "organization_security_defaults_migration_deny" ON public.organization_security_defaults';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
