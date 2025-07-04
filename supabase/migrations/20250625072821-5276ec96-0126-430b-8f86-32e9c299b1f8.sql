
-- Create project_invitations table to track user invitations
CREATE TABLE public.project_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer', 'member')),
  invited_by UUID NOT NULL,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  message TEXT,
  UNIQUE(project_id, email)
);

-- Enable RLS on project_invitations
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- Create permission_templates table for reusable permission sets
CREATE TABLE public.permission_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on permission_templates
ALTER TABLE public.permission_templates ENABLE ROW LEVEL SECURITY;

-- Create permission_audit_log table for tracking changes
CREATE TABLE public.permission_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('granted', 'revoked', 'modified', 'invited', 'removed')),
  permission_type TEXT NOT NULL,
  permission_details JSONB NOT NULL DEFAULT '{}',
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on permission_audit_log
ALTER TABLE public.permission_audit_log ENABLE ROW LEVEL SECURITY;

-- Create function to get comprehensive project user information
CREATE OR REPLACE FUNCTION public.get_project_users_with_permissions(project_id_param UUID)
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE,
  assigned_by UUID,
  last_activity TIMESTAMP WITH TIME ZONE,
  project_permissions JSONB,
  asset_permissions JSONB,
  effective_permissions JSONB
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    pu.user_id,
    up.email,
    up.first_name,
    up.last_name,
    pu.role,
    pu.assigned_at,
    pu.assigned_by,
    up.updated_at as last_activity,
    COALESCE(
      jsonb_object_agg(
        pp.resource_type, 
        pp.permission_level
      ) FILTER (WHERE pp.resource_type IS NOT NULL),
      '{}'::jsonb
    ) as project_permissions,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'asset_type', ap.asset_type,
          'asset_id', ap.asset_id,
          'permission_type', ap.permission_type
        )
      ) FILTER (WHERE ap.asset_type IS NOT NULL),
      '[]'::jsonb
    ) as asset_permissions,
    jsonb_build_object(
      'is_project_admin', (pu.role = 'admin' OR EXISTS(SELECT 1 FROM public.projects p WHERE p.id = project_id_param AND p.created_by = pu.user_id)),
      'is_org_admin', (up.role = 'admin'),
      'can_manage_users', (pu.role = 'admin' OR up.role = 'admin'),
      'can_manage_settings', (pu.role = 'admin' OR up.role = 'admin')
    ) as effective_permissions
  FROM public.project_users pu
  JOIN public.user_profiles up ON pu.user_id = up.id
  LEFT JOIN public.project_permissions pp ON pp.project_id = pu.project_id AND pp.user_id = pu.user_id
  LEFT JOIN public.asset_permissions ap ON ap.project_id = pu.project_id AND ap.user_id = pu.user_id
  WHERE pu.project_id = project_id_param
  GROUP BY pu.user_id, up.email, up.first_name, up.last_name, pu.role, pu.assigned_at, pu.assigned_by, up.updated_at, up.role;
$$;

-- Create function to invite user to project
CREATE OR REPLACE FUNCTION public.invite_user_to_project(
  project_id_param UUID,
  email_param TEXT,
  role_param TEXT,
  message_param TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_id UUID;
  existing_user_id UUID;
BEGIN
  -- Check if user already exists in the project
  SELECT pu.user_id INTO existing_user_id
  FROM public.project_users pu
  JOIN public.user_profiles up ON pu.user_id = up.id
  WHERE pu.project_id = project_id_param AND up.email = email_param;
  
  IF existing_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'User is already a member of this project';
  END IF;
  
  -- Check if there's already a pending invitation
  SELECT id INTO invitation_id
  FROM public.project_invitations 
  WHERE project_id = project_id_param 
    AND email = email_param 
    AND status = 'pending' 
    AND expires_at > now();
    
  IF invitation_id IS NOT NULL THEN
    -- Update existing invitation
    UPDATE public.project_invitations 
    SET role = role_param, 
        message = message_param,
        invited_at = now(),
        expires_at = now() + INTERVAL '7 days'
    WHERE id = invitation_id;
  ELSE
    -- Create new invitation
    INSERT INTO public.project_invitations (project_id, email, role, invited_by, message)
    VALUES (project_id_param, email_param, role_param, auth.uid(), message_param)
    RETURNING id INTO invitation_id;
  END IF;
  
  RETURN invitation_id;
END;
$$;

-- RLS Policies for project_invitations
CREATE POLICY "Users can view project invitations they have access to" 
  ON public.project_invitations 
  FOR SELECT 
  USING (
    public.has_project_permission(project_id, auth.uid(), 'users', 'view')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Project admins can manage invitations" 
  ON public.project_invitations 
  FOR ALL
  USING (
    public.has_project_permission(project_id, auth.uid(), 'users', 'admin')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.created_by = auth.uid()
    )
  );

-- RLS Policies for permission_templates
CREATE POLICY "Users can view project permission templates" 
  ON public.permission_templates 
  FOR SELECT 
  USING (
    public.has_project_permission(project_id, auth.uid(), 'users', 'view')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Project admins can manage permission templates" 
  ON public.permission_templates 
  FOR ALL
  USING (
    public.has_project_permission(project_id, auth.uid(), 'users', 'admin')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.created_by = auth.uid()
    )
  );

-- RLS Policies for permission_audit_log
CREATE POLICY "Users can view permission audit logs for their projects" 
  ON public.permission_audit_log 
  FOR SELECT 
  USING (
    public.has_project_permission(project_id, auth.uid(), 'users', 'view')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "System can insert audit logs" 
  ON public.permission_audit_log 
  FOR INSERT 
  WITH CHECK (true);

-- Add triggers for updated_at columns
CREATE TRIGGER update_permission_templates_updated_at 
  BEFORE UPDATE ON public.permission_templates 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();
