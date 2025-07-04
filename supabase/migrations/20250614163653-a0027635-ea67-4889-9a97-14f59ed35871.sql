
-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL,
  created_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project_users table for project memberships
CREATE TABLE public.project_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  assigned_by UUID,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Add project_id to existing tables
ALTER TABLE public.forms ADD COLUMN project_id UUID;
ALTER TABLE public.reports ADD COLUMN project_id UUID;
ALTER TABLE public.workflows ADD COLUMN project_id UUID;
ALTER TABLE public.form_assignments ADD COLUMN project_id UUID;

-- Enable RLS on new tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_users ENABLE ROW LEVEL SECURITY;

-- RLS policies for projects table
CREATE POLICY "Users can view projects they belong to" 
  ON public.projects 
  FOR SELECT 
  USING (
    id IN (
      SELECT project_id FROM public.project_users 
      WHERE user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

CREATE POLICY "Only admins can create projects" 
  ON public.projects 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
      AND organization_id = projects.organization_id
    )
  );

CREATE POLICY "Project creators and admins can update projects" 
  ON public.projects 
  FOR UPDATE 
  USING (
    created_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
      AND organization_id = projects.organization_id
    )
  );

-- RLS policies for project_users table
CREATE POLICY "Users can view project memberships for their projects" 
  ON public.project_users 
  FOR SELECT 
  USING (
    project_id IN (
      SELECT project_id FROM public.project_users 
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Project admins can manage project users" 
  ON public.project_users 
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.project_users pu
      JOIN public.projects p ON p.id = pu.project_id
      WHERE pu.project_id = project_users.project_id
      AND pu.user_id = auth.uid()
      AND (pu.role = 'admin' OR p.created_by = auth.uid())
    )
  );

-- Create trigger for updated_at on projects
CREATE TRIGGER update_projects_updated_at 
  BEFORE UPDATE ON public.projects 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create default projects for existing organizations and migrate data
INSERT INTO public.projects (name, description, organization_id, created_by)
SELECT 
  'Default Project',
  'Auto-created default project for existing data',
  o.id,
  (SELECT id FROM public.user_profiles WHERE organization_id = o.id AND role = 'admin' LIMIT 1)
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.projects WHERE organization_id = o.id
);

-- Assign all existing org users to their default projects
INSERT INTO public.project_users (project_id, user_id, role, assigned_by)
SELECT 
  p.id,
  up.id,
  CASE WHEN up.role = 'admin' THEN 'admin' ELSE 'member' END,
  p.created_by
FROM public.projects p
JOIN public.user_profiles up ON up.organization_id = p.organization_id
WHERE p.name = 'Default Project'
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Update existing forms to belong to default projects
UPDATE public.forms 
SET project_id = (
  SELECT p.id 
  FROM public.projects p 
  JOIN public.user_profiles up ON up.organization_id = p.organization_id
  WHERE p.name = 'Default Project' 
  AND up.email = forms.created_by
  LIMIT 1
)
WHERE project_id IS NULL;

-- Update existing reports to belong to default projects  
UPDATE public.reports 
SET project_id = (
  SELECT p.id 
  FROM public.projects p 
  JOIN public.user_profiles up ON up.organization_id = p.organization_id
  WHERE p.name = 'Default Project' 
  AND up.id = reports.created_by
  LIMIT 1
)
WHERE project_id IS NULL;

-- Update existing workflows to belong to default projects
UPDATE public.workflows 
SET project_id = (
  SELECT p.id 
  FROM public.projects p 
  JOIN public.user_profiles up ON up.organization_id = p.organization_id
  WHERE p.name = 'Default Project' 
  AND up.id = workflows.created_by
  LIMIT 1
)
WHERE project_id IS NULL;

-- Make project_id NOT NULL after migration
ALTER TABLE public.forms ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.reports ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.workflows ALTER COLUMN project_id SET NOT NULL;
