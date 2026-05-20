CREATE POLICY "Users can view their own role assignments"
ON public.user_role_assignments
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can view assigned roles"
ON public.roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.role_id = roles.id
      AND ura.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view permissions for assigned roles"
ON public.role_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.role_id = role_permissions.role_id
      AND ura.user_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';