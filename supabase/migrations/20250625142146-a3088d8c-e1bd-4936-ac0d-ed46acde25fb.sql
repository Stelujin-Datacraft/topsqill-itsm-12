
-- Add new form-specific permission types to the asset_permissions table
-- These permissions provide granular control over form access

-- First, let's update the permission_type check constraint to include all form permissions
ALTER TABLE public.asset_permissions 
DROP CONSTRAINT IF EXISTS asset_permissions_permission_type_check;

ALTER TABLE public.asset_permissions 
ADD CONSTRAINT asset_permissions_permission_type_check 
CHECK (permission_type IN (
  'view', 'edit', 'delete', 'share',
  'view_records', 'export_records', 'start_instances',
  'view_form', 'submit_form', 'edit_form', 'edit_rules',
  'view_submissions', 'create_records', 'export_data',
  'manage_access', 'change_settings', 'change_lifecycle'
));

-- Create a function to get user's effective permissions for a form
-- This considers both explicit permissions and inherited permissions from project roles
CREATE OR REPLACE FUNCTION public.get_user_form_permissions(
  _project_id UUID,
  _user_id UUID,
  _form_id UUID
)
RETURNS TABLE(permission_type TEXT, granted_explicitly BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Get explicit asset permissions
  SELECT 
    ap.permission_type,
    true as granted_explicitly
  FROM public.asset_permissions ap
  WHERE ap.project_id = _project_id
    AND ap.user_id = _user_id
    AND ap.asset_type = 'form'
    AND ap.asset_id = _form_id
  
  UNION
  
  -- Get inherited permissions from project roles - admin/creator permissions
  SELECT 
    permission_type,
    false as granted_explicitly
  FROM (
    SELECT unnest(ARRAY['view_form', 'submit_form', 'edit_form', 'edit_rules', 
                         'view_submissions', 'create_records', 'export_data',
                         'manage_access', 'change_settings', 'change_lifecycle']) as permission_type
  ) perms
  WHERE EXISTS (
    SELECT 1 FROM public.project_users pu
    JOIN public.projects p ON p.id = pu.project_id
    WHERE pu.project_id = _project_id
      AND pu.user_id = _user_id
      AND (pu.role = 'admin' OR p.created_by = _user_id)
  )
  
  UNION
  
  -- Get inherited permissions from project roles - editor permissions
  SELECT 
    permission_type,
    false as granted_explicitly
  FROM (
    SELECT unnest(ARRAY['view_form', 'submit_form', 'edit_form', 'view_submissions', 'create_records']) as permission_type
  ) perms
  WHERE EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = _project_id
      AND pu.user_id = _user_id
      AND pu.role = 'editor'
  )
  
  UNION
  
  -- Get inherited permissions from project roles - viewer permissions
  SELECT 
    permission_type,
    false as granted_explicitly
  FROM (
    SELECT unnest(ARRAY['view_form']) as permission_type
  ) perms
  WHERE EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = _project_id
      AND pu.user_id = _user_id
      AND pu.role = 'viewer'
  );
$$;

-- Create a function to check if a form is public
CREATE OR REPLACE FUNCTION public.is_form_public(_form_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(f.is_public, false)
  FROM public.forms f
  WHERE f.id = _form_id;
$$;

-- Create a comprehensive function to get all users and their form permissions for a project
CREATE OR REPLACE FUNCTION public.get_project_users_form_permissions(_project_id UUID, _form_id UUID)
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  project_role TEXT,
  permissions JSONB,
  has_explicit_permissions BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    pu.user_id,
    up.email,
    up.first_name,
    up.last_name,
    pu.role as project_role,
    COALESCE(
      jsonb_object_agg(
        perm.permission_type,
        jsonb_build_object(
          'granted', true,
          'explicit', perm.granted_explicitly
        )
      ) FILTER (WHERE perm.permission_type IS NOT NULL),
      '{}'::jsonb
    ) as permissions,
    EXISTS(
      SELECT 1 FROM public.asset_permissions ap
      WHERE ap.project_id = _project_id
        AND ap.user_id = pu.user_id
        AND ap.asset_type = 'form'
        AND ap.asset_id = _form_id
    ) as has_explicit_permissions
  FROM public.project_users pu
  JOIN public.user_profiles up ON pu.user_id = up.id
  LEFT JOIN public.get_user_form_permissions(_project_id, pu.user_id, _form_id) perm ON true
  WHERE pu.project_id = _project_id
  GROUP BY pu.user_id, up.email, up.first_name, up.last_name, pu.role;
$$;
