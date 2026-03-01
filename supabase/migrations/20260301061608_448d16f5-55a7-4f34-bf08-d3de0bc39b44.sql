
-- Create knowledge_base_folders table (similar to dashboards for reports)
CREATE TABLE public.knowledge_base_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_base_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view KB folders in their org"
  ON public.knowledge_base_folders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_users pu
      WHERE pu.project_id = knowledge_base_folders.project_id
      AND pu.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
      AND up.organization_id = knowledge_base_folders.organization_id
    )
  );

CREATE POLICY "Admins can insert KB folders"
  ON public.knowledge_base_folders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY "Admins can update KB folders"
  ON public.knowledge_base_folders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete KB folders"
  ON public.knowledge_base_folders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Add folder_id to policies table
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.knowledge_base_folders(id) ON DELETE SET NULL;

-- Add item_type to policies to distinguish Policy vs Audit
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'policy';
