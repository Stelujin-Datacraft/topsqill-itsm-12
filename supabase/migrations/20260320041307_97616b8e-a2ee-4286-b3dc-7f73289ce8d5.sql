
-- Performance Audit Trail table for tracking all module actions
CREATE TABLE public.performance_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  performance_project_id UUID REFERENCES public.performance_projects(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'analysis_run', 'alert_created', 'alert_acknowledged', 'alert_resolved', 'alert_dismissed', 'threshold_created', 'threshold_deleted', 'data_source_added', 'data_source_removed', 'location_updated', 'questionnaire_submitted', 'scenario_run'
  action_category TEXT NOT NULL DEFAULT 'general', -- 'analysis', 'alerts', 'thresholds', 'data_sources', 'gis', 'questionnaire', 'scenarios'
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_perf_audit_project ON public.performance_audit_logs(project_id, created_at DESC);
CREATE INDEX idx_perf_audit_perf_project ON public.performance_audit_logs(performance_project_id, created_at DESC);
CREATE INDEX idx_perf_audit_category ON public.performance_audit_logs(action_category);

-- Enable RLS
ALTER TABLE public.performance_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view performance audit logs for their org projects"
ON public.performance_audit_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = performance_audit_logs.project_id
    AND pu.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = performance_audit_logs.project_id
    AND p.created_by = auth.uid()
  )
);

CREATE POLICY "Users can insert performance audit logs for their projects"
ON public.performance_audit_logs FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = performance_audit_logs.project_id
    AND pu.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = performance_audit_logs.project_id
    AND p.created_by = auth.uid()
  )
);
