
-- Technical Questionnaire responses table
CREATE TABLE public.performance_questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  performance_project_id UUID REFERENCES public.performance_projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  respondent_id UUID NOT NULL REFERENCES auth.users(id),
  category TEXT NOT NULL,
  question_key TEXT NOT NULL,
  question_text TEXT NOT NULL,
  response TEXT,
  score INTEGER CHECK (score >= 0 AND score <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(performance_project_id, respondent_id, question_key)
);

ALTER TABLE public.performance_questionnaire_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view questionnaire responses in their projects"
  ON public.performance_questionnaire_responses FOR SELECT TO authenticated
  USING (project_id IN (SELECT project_id FROM public.project_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert questionnaire responses"
  ON public.performance_questionnaire_responses FOR INSERT TO authenticated
  WITH CHECK (respondent_id = auth.uid() AND project_id IN (SELECT project_id FROM public.project_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own responses"
  ON public.performance_questionnaire_responses FOR UPDATE TO authenticated
  USING (respondent_id = auth.uid());

-- Add location fields to performance_projects for GIS
ALTER TABLE public.performance_projects 
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_name TEXT;
