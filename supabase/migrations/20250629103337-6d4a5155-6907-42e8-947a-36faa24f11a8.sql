
-- Create roles table for centralized role management
CREATE TABLE public.roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  organization_id UUID NOT NULL,
  top_level_access TEXT NOT NULL DEFAULT 'no_access' CHECK (top_level_access IN ('creator', 'editor', 'viewer', 'no_access')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name, organization_id)
);

-- Create role permissions table for storing detailed permissions
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('project', 'form', 'workflow', 'report')),
  resource_id UUID, -- NULL means applies to all resources of this type
  permission_type TEXT NOT NULL CHECK (permission_type IN ('create', 'read', 'update', 'delete')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role_id, resource_type, resource_id, permission_type)
);

-- Create user role assignments table
CREATE TABLE public.user_role_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- Create group roles table for future group-based access
CREATE TABLE public.group_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name, organization_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for roles table
CREATE POLICY "Organization admins can manage roles"
  ON public.roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() 
      AND up.role = 'admin'
      AND up.organization_id = roles.organization_id
    )
  );

-- RLS policies for role_permissions table
CREATE POLICY "Organization admins can manage role permissions"
  ON public.role_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      JOIN public.user_profiles up ON up.organization_id = r.organization_id
      WHERE r.id = role_permissions.role_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
    )
  );

-- RLS policies for user_role_assignments table
CREATE POLICY "Organization admins can manage user role assignments"
  ON public.user_role_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      JOIN public.user_profiles up ON up.organization_id = r.organization_id
      WHERE r.id = user_role_assignments.role_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
    )
  );

-- RLS policies for group_roles table
CREATE POLICY "Organization admins can manage group roles"
  ON public.group_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.organization_id = group_roles.organization_id
    )
  );

-- Function to get user's effective permissions based on assigned roles
CREATE OR REPLACE FUNCTION public.get_user_effective_permissions(
  _user_id UUID,
  _resource_type TEXT,
  _resource_id UUID DEFAULT NULL
)
RETURNS TABLE(permission_type TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT rp.permission_type
  FROM public.user_role_assignments ura
  JOIN public.roles r ON r.id = ura.role_id
  JOIN public.role_permissions rp ON rp.role_id = r.id
  WHERE ura.user_id = _user_id
    AND rp.resource_type = _resource_type
    AND (rp.resource_id IS NULL OR rp.resource_id = _resource_id);
$$;

-- Function to check if user has specific permission through roles
CREATE OR REPLACE FUNCTION public.user_has_role_permission(
  _user_id UUID,
  _resource_type TEXT,
  _permission_type TEXT,
  _resource_id UUID DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.get_user_effective_permissions(_user_id, _resource_type, _resource_id) ep
    WHERE ep.permission_type = _permission_type
  );
$$;
