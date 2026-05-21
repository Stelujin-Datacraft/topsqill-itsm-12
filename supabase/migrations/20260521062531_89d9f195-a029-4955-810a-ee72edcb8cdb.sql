
-- Fix infinite recursion between roles and user_role_assignments RLS policies
-- by using SECURITY DEFINER helper functions.

CREATE OR REPLACE FUNCTION public.user_has_role_assignment(_user_id uuid, _role_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
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
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.roles r
    JOIN public.user_profiles up
      ON up.organization_id = r.organization_id
    WHERE r.id = _role_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
  );
$$;

-- Replace recursive policy on roles
DROP POLICY IF EXISTS "Users can view assigned roles" ON public.roles;
CREATE POLICY "Users can view assigned roles"
ON public.roles
FOR SELECT
USING (public.user_has_role_assignment(auth.uid(), id));

-- Replace recursive policy on user_role_assignments
DROP POLICY IF EXISTS "Organization admins can manage user role assignments" ON public.user_role_assignments;
CREATE POLICY "Organization admins can manage user role assignments"
ON public.user_role_assignments
FOR ALL
USING (public.is_admin_of_role(role_id))
WITH CHECK (public.is_admin_of_role(role_id));

-- Replace recursive policy on role_permissions (same pattern)
DROP POLICY IF EXISTS "Organization admins can manage role permissions" ON public.role_permissions;
CREATE POLICY "Organization admins can manage role permissions"
ON public.role_permissions
FOR ALL
USING (public.is_admin_of_role(role_id))
WITH CHECK (public.is_admin_of_role(role_id));
