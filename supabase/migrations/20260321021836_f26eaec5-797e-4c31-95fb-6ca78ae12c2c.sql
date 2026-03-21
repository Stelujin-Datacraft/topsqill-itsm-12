
CREATE TABLE public.performance_analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  performance_project_id uuid REFERENCES public.performance_projects(id) ON DELETE CASCADE,
  submission_id uuid,
  analysis_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.performance_analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their project analysis results"
  ON public.performance_analysis_results FOR SELECT TO authenticated
  USING (project_id IN (SELECT project_id FROM public.project_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert analysis results"
  ON public.performance_analysis_results FOR INSERT TO authenticated
  WITH CHECK (project_id IN (SELECT project_id FROM public.project_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete analysis results"
  ON public.performance_analysis_results FOR DELETE TO authenticated
  USING (project_id IN (SELECT project_id FROM public.project_users WHERE user_id = auth.uid()));

CREATE INDEX idx_perf_analysis_results_lookup ON public.performance_analysis_results (project_id, performance_project_id, submission_id);
