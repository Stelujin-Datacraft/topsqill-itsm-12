
-- Create performance_projects table (one per form for isolated analysis)
CREATE TABLE public.performance_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  form_name TEXT NOT NULL,
  created_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, form_id)
);

-- Enable RLS
ALTER TABLE public.performance_projects ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view performance projects in their org"
  ON public.performance_projects FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_users pu
      WHERE pu.project_id = performance_projects.project_id
      AND pu.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert performance projects"
  ON public.performance_projects FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update performance projects"
  ON public.performance_projects FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_users pu
      WHERE pu.project_id = performance_projects.project_id
      AND pu.user_id = auth.uid()
      AND pu.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Users can delete performance projects"
  ON public.performance_projects FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.project_users pu
      WHERE pu.project_id = performance_projects.project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
    )
  );

-- Add performance_project_id to related tables
ALTER TABLE public.performance_data_sources ADD COLUMN IF NOT EXISTS performance_project_id UUID REFERENCES public.performance_projects(id) ON DELETE CASCADE;
ALTER TABLE public.performance_thresholds ADD COLUMN IF NOT EXISTS performance_project_id UUID REFERENCES public.performance_projects(id) ON DELETE CASCADE;
ALTER TABLE public.performance_alerts ADD COLUMN IF NOT EXISTS performance_project_id UUID REFERENCES public.performance_projects(id) ON DELETE CASCADE;
ALTER TABLE public.performance_predictions ADD COLUMN IF NOT EXISTS performance_project_id UUID REFERENCES public.performance_projects(id) ON DELETE CASCADE;
