
-- Many-to-many role assignment for groups
CREATE TABLE IF NOT EXISTS public.group_role_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_group_role_assignments_group ON public.group_role_assignments(group_id);
CREATE INDEX IF NOT EXISTS idx_group_role_assignments_role ON public.group_role_assignments(role_id);

ALTER TABLE public.group_role_assignments ENABLE ROW LEVEL SECURITY;

-- Backfill existing single role_id values into the new table
INSERT INTO public.group_role_assignments (group_id, role_id, assigned_by)
SELECT g.id, g.role_id, g.created_by
FROM public.groups g
WHERE g.role_id IS NOT NULL
ON CONFLICT (group_id, role_id) DO NOTHING;

-- Security definer helper: is current user an admin of the org owning this group?
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

-- Helper: can the current user see this group's role assignments
-- (admin OR member of the group's org)
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

CREATE POLICY "Users can view group role assignments in their org"
ON public.group_role_assignments
FOR SELECT
TO authenticated
USING (public.can_view_group(group_id));

CREATE POLICY "Admins can manage group role assignments"
ON public.group_role_assignments
FOR ALL
TO authenticated
USING (public.is_admin_of_group(group_id))
WITH CHECK (public.is_admin_of_group(group_id));

NOTIFY pgrst, 'reload schema';
