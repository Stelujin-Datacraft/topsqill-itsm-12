
-- Create asset_permissions table for granular asset-level access control
CREATE TABLE public.asset_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('form', 'report', 'workflow')),
  asset_id UUID NOT NULL,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'edit', 'delete', 'share', 'view_records', 'export_records', 'start_instances')),
  granted_by UUID,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id, asset_type, asset_id, permission_type)
);

-- Enable RLS on asset_permissions
ALTER TABLE public.asset_permissions ENABLE ROW LEVEL SECURITY;

-- Update project_users table to use proper project roles
ALTER TABLE public.project_users 
DROP CONSTRAINT IF EXISTS project_users_role_check;

ALTER TABLE public.project_users 
ADD CONSTRAINT project_users_role_check 
CHECK (role IN ('admin', 'editor', 'viewer', 'member'));

-- Create comprehensive permission checking function for assets
CREATE OR REPLACE FUNCTION public.has_asset_permission(
  _project_id UUID,
  _user_id UUID,
  _asset_type TEXT,
  _asset_id UUID,
  _permission_type TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Check if user is project admin (implicit full access)
  SELECT EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = _project_id
    AND pu.user_id = _user_id
    AND pu.role = 'admin'
  ) OR EXISTS (
    -- Check explicit asset permission
    SELECT 1 FROM public.asset_permissions ap
    WHERE ap.project_id = _project_id
    AND ap.user_id = _user_id
    AND ap.asset_type = _asset_type
    AND ap.asset_id = _asset_id
    AND ap.permission_type = _permission_type
  ) OR EXISTS (
    -- Check if user is project creator (implicit admin)
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
    AND p.created_by = _user_id
  );
$$;

-- Create function to check if user can create assets in project
CREATE OR REPLACE FUNCTION public.can_create_asset_in_project(
  _project_id UUID,
  _user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = _project_id
    AND pu.user_id = _user_id
    AND pu.role IN ('admin', 'editor')
  ) OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
    AND p.created_by = _user_id
  );
$$;

-- Create function to automatically grant full permissions to asset creator
CREATE OR REPLACE FUNCTION public.grant_creator_asset_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _asset_type TEXT;
  _creator_id UUID;
  _project_id UUID;
BEGIN
  -- Determine asset type and get creator/project info
  IF TG_TABLE_NAME = 'forms' THEN
    _asset_type := 'form';
    _creator_id := NEW.created_by::UUID;
    _project_id := NEW.project_id;
  ELSIF TG_TABLE_NAME = 'reports' THEN
    _asset_type := 'report';
    _creator_id := NEW.created_by;
    _project_id := NEW.project_id;
  ELSIF TG_TABLE_NAME = 'workflows' THEN
    _asset_type := 'workflow';
    _creator_id := NEW.created_by;
    _project_id := NEW.project_id;
  ELSE
    RETURN NEW;
  END IF;

  -- Grant full permissions to creator (except if they're already project admin)
  IF NOT EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = _project_id
    AND pu.user_id = _creator_id
    AND pu.role = 'admin'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
    AND p.created_by = _creator_id
  ) THEN
    -- Insert all relevant permissions for the creator
    INSERT INTO public.asset_permissions (project_id, user_id, asset_type, asset_id, permission_type, granted_by)
    VALUES 
      (_project_id, _creator_id, _asset_type, NEW.id, 'view', _creator_id),
      (_project_id, _creator_id, _asset_type, NEW.id, 'edit', _creator_id),
      (_project_id, _creator_id, _asset_type, NEW.id, 'delete', _creator_id),
      (_project_id, _creator_id, _asset_type, NEW.id, 'share', _creator_id);
    
    -- Add asset-specific permissions
    IF _asset_type = 'form' THEN
      INSERT INTO public.asset_permissions (project_id, user_id, asset_type, asset_id, permission_type, granted_by)
      VALUES 
        (_project_id, _creator_id, _asset_type, NEW.id, 'view_records', _creator_id),
        (_project_id, _creator_id, _asset_type, NEW.id, 'export_records', _creator_id);
    ELSIF _asset_type = 'workflow' THEN
      INSERT INTO public.asset_permissions (project_id, user_id, asset_type, asset_id, permission_type, granted_by)
      VALUES 
        (_project_id, _creator_id, _asset_type, NEW.id, 'start_instances', _creator_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create triggers for automatic permission granting
CREATE TRIGGER grant_form_creator_permissions
  AFTER INSERT ON public.forms
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_creator_asset_permissions();

CREATE TRIGGER grant_report_creator_permissions
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_creator_asset_permissions();

CREATE TRIGGER grant_workflow_creator_permissions
  AFTER INSERT ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_creator_asset_permissions();

-- RLS policies for asset_permissions
CREATE POLICY "Users can view asset permissions for their projects" 
  ON public.asset_permissions 
  FOR SELECT 
  USING (
    public.has_project_permission(project_id, auth.uid(), 'users', 'view')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Project admins can manage asset permissions" 
  ON public.asset_permissions 
  FOR ALL
  USING (
    public.has_project_permission(project_id, auth.uid(), 'users', 'admin')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.created_by = auth.uid()
    )
  );

-- Add trigger for updated_at on asset_permissions
CREATE TRIGGER update_asset_permissions_updated_at 
  BEFORE UPDATE ON public.asset_permissions 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();
