-- Performance data source configuration - links forms to performance analysis
CREATE TABLE public.performance_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  created_by UUID NOT NULL,
  source_form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  source_form_name TEXT NOT NULL DEFAULT '',
  field_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_forms JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_limit INTEGER NOT NULL DEFAULT 500,
  date_field_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project data sources"
  ON public.performance_data_sources FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "Users can create data sources in their projects"
  ON public.performance_data_sources FOR INSERT TO authenticated
  WITH CHECK (public.can_create_asset_in_project(project_id, auth.uid()));

CREATE POLICY "Users can update own project data sources"
  ON public.performance_data_sources FOR UPDATE TO authenticated
  USING (public.can_create_asset_in_project(project_id, auth.uid()));

CREATE POLICY "Users can delete own project data sources"
  ON public.performance_data_sources FOR DELETE TO authenticated
  USING (public.can_create_asset_in_project(project_id, auth.uid()));

-- Add form-based fields to thresholds
ALTER TABLE public.performance_thresholds 
  ADD COLUMN IF NOT EXISTS data_source_id UUID REFERENCES public.performance_data_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS form_field_id TEXT,
  ADD COLUMN IF NOT EXISTS form_field_label TEXT,
  ADD COLUMN IF NOT EXISTS data_limit INTEGER DEFAULT 100;