
-- Create project_permissions table for granular access control
CREATE TABLE public.project_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('workflows', 'forms', 'reports', 'users', 'settings')),
  permission_level TEXT NOT NULL CHECK (permission_level IN ('admin', 'edit', 'view')),
  granted_by UUID,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id, resource_type)
);

-- Enable RLS on project_permissions
ALTER TABLE public.project_permissions ENABLE ROW LEVEL SECURITY;

-- Create helper function to check project permissions
CREATE OR REPLACE FUNCTION public.has_project_permission(
  _project_id UUID,
  _user_id UUID,
  _resource_type TEXT,
  _required_level TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_permissions pp
    WHERE pp.project_id = _project_id
    AND pp.user_id = _user_id
    AND pp.resource_type = _resource_type
    AND (
      pp.permission_level = 'admin' OR
      (_required_level = 'view' AND pp.permission_level IN ('view', 'edit', 'admin')) OR
      (_required_level = 'edit' AND pp.permission_level IN ('edit', 'admin'))
    )
  ) OR EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = _project_id
    AND pu.user_id = _user_id
    AND pu.role = 'admin'
  );
$$;

-- Create function to check if user can view project
CREATE OR REPLACE FUNCTION public.can_view_project(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = _project_id
    AND pu.user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.project_permissions pp
    WHERE pp.project_id = _project_id
    AND pp.user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
    AND p.created_by = _user_id
  );
$$;

-- Update RLS policies for projects to use the new permission system
DROP POLICY IF EXISTS "Users can view projects in their organization" ON public.projects;

CREATE POLICY "Users can view projects they have access to" 
  ON public.projects 
  FOR SELECT 
  USING (
    public.can_view_project(id, auth.uid())
  );

-- RLS policies for project_permissions
CREATE POLICY "Users can view project permissions for their projects" 
  ON public.project_permissions 
  FOR SELECT 
  USING (
    public.has_project_permission(project_id, auth.uid(), 'users', 'view')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Project admins can manage project permissions" 
  ON public.project_permissions 
  FOR ALL
  USING (
    public.has_project_permission(project_id, auth.uid(), 'users', 'admin')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.created_by = auth.uid()
    )
  );

-- Create trigger for updated_at on project_permissions
CREATE TRIGGER update_project_permissions_updated_at 
  BEFORE UPDATE ON public.project_permissions 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();
