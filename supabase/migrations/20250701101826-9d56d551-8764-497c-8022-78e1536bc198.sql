
-- Create table for top-level permissions
CREATE TABLE public.project_top_level_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('projects', 'forms', 'workflows', 'reports')),
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_read BOOLEAN NOT NULL DEFAULT true,
  can_update BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id, entity_type)
);

-- Enable RLS on the table
ALTER TABLE public.project_top_level_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for top-level permissions
CREATE POLICY "Project admins can manage top-level permissions"
  ON public.project_top_level_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_profiles up ON up.id = auth.uid()
      WHERE p.id = project_top_level_permissions.project_id
      AND (p.created_by = auth.uid() OR up.role = 'admin')
    )
  );

-- Allow users to view top-level permissions for projects they have access to
CREATE POLICY "Users can view project top-level permissions"
  ON public.project_top_level_permissions
  FOR SELECT
  USING (
    EXISTS (
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
          WHERE up.id = auth.uid() AND up.role = 'admin'
        )
      )
    )
  );

-- Function to initialize default top-level permissions for a user in a project
CREATE OR REPLACE FUNCTION public.initialize_default_top_level_permissions(
  _project_id UUID,
  _user_id UUID,
  _created_by UUID
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
AS $$
  INSERT INTO public.project_top_level_permissions (
    project_id, user_id, entity_type, can_create, can_read, can_update, can_delete, created_by
  ) VALUES
    (_project_id, _user_id, 'projects', false, true, false, false, _created_by),
    (_project_id, _user_id, 'forms', false, true, false, false, _created_by),
    (_project_id, _user_id, 'workflows', false, true, false, false, _created_by),
    (_project_id, _user_id, 'reports', false, true, false, false, _created_by)
  ON CONFLICT (project_id, user_id, entity_type) DO NOTHING;
$$;

-- Function to check if user has effective permission (intersection of top-level and role permissions)
CREATE OR REPLACE FUNCTION public.has_effective_permission(
  _project_id UUID,
  _user_id UUID,
  _entity_type TEXT,
  _permission_type TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (
      SELECT 
        CASE _permission_type
          WHEN 'create' THEN can_create
          WHEN 'read' THEN can_read  
          WHEN 'update' THEN can_update
          WHEN 'delete' THEN can_delete
          ELSE false
        END
      FROM public.project_top_level_permissions
      WHERE project_id = _project_id 
        AND user_id = _user_id 
        AND entity_type = _entity_type
    ),
    CASE WHEN _permission_type = 'read' THEN true ELSE false END
  );
$$;
