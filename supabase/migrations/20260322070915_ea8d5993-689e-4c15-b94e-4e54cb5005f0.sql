
-- Performance roles for role-based KPI dashboards
CREATE TABLE public.performance_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  performance_project_id UUID REFERENCES public.performance_projects(id) ON DELETE CASCADE,
  role_type TEXT NOT NULL CHECK (role_type IN ('senior_management', 'project_manager', 'discipline_engineer', 'finance_contract', 'risk_governance')),
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id, performance_project_id)
);

ALTER TABLE public.performance_user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own performance roles"
  ON public.performance_user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can manage performance roles"
  ON public.performance_user_roles FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));
