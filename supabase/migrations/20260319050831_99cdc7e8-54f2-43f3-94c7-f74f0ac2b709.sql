
-- Project Performance Monitoring Tables

-- 1. Performance Snapshots - periodic project data captures
CREATE TABLE public.performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  created_by UUID NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Budget tracking
  planned_budget NUMERIC(15,2) DEFAULT 0,
  actual_budget NUMERIC(15,2) DEFAULT 0,
  budget_variance NUMERIC(15,2) GENERATED ALWAYS AS (actual_budget - planned_budget) STORED,
  
  -- Timeline tracking
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  projected_end_date DATE,
  schedule_variance_days INTEGER DEFAULT 0,
  
  -- Resource allocation
  planned_resources INTEGER DEFAULT 0,
  actual_resources INTEGER DEFAULT 0,
  resource_utilization_pct NUMERIC(5,2) DEFAULT 0,
  
  -- Task progress
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  in_progress_tasks INTEGER DEFAULT 0,
  blocked_tasks INTEGER DEFAULT 0,
  completion_pct NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_tasks > 0 THEN (completed_tasks::NUMERIC / total_tasks * 100) ELSE 0 END
  ) STORED,
  
  -- Milestones
  total_milestones INTEGER DEFAULT 0,
  completed_milestones INTEGER DEFAULT 0,
  overdue_milestones INTEGER DEFAULT 0,
  
  -- Risk & health
  risk_score NUMERIC(5,2) DEFAULT 0,
  health_status TEXT DEFAULT 'green' CHECK (health_status IN ('green', 'yellow', 'orange', 'red')),
  
  -- Custom metrics (flexible JSONB for additional KPIs)
  custom_metrics JSONB DEFAULT '{}'::JSONB,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Performance Alerts - triggered by AI or thresholds
CREATE TABLE public.performance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  snapshot_id UUID REFERENCES public.performance_snapshots(id) ON DELETE SET NULL,
  
  alert_type TEXT NOT NULL CHECK (alert_type IN ('budget_overrun', 'schedule_delay', 'resource_shortage', 'milestone_risk', 'task_bottleneck', 'anomaly', 'prediction')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  
  -- AI-specific fields
  ai_generated BOOLEAN DEFAULT false,
  ai_confidence NUMERIC(5,2),
  ai_reasoning TEXT,
  ai_recommendation TEXT,
  
  -- Alert thresholds
  metric_name TEXT,
  threshold_value NUMERIC(15,2),
  actual_value NUMERIC(15,2),
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  
  -- Notification tracking
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. AI Predictions - historical predictions for tracking accuracy
CREATE TABLE public.performance_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('budget_forecast', 'completion_date', 'resource_need', 'risk_trend', 'milestone_delay')),
  prediction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date DATE,
  
  -- Prediction values
  predicted_value NUMERIC(15,2),
  confidence_level NUMERIC(5,2),
  prediction_range_low NUMERIC(15,2),
  prediction_range_high NUMERIC(15,2),
  
  -- AI model info
  model_used TEXT DEFAULT 'gemini-3-flash-preview',
  input_data_points INTEGER DEFAULT 0,
  reasoning TEXT,
  
  -- Accuracy tracking (filled in later when actual values are known)
  actual_value NUMERIC(15,2),
  accuracy_pct NUMERIC(5,2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Performance Thresholds - configurable alert triggers
CREATE TABLE public.performance_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  created_by UUID NOT NULL,
  
  metric_name TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('>', '<', '>=', '<=', '==', '!=')),
  threshold_value NUMERIC(15,2) NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_active BOOLEAN DEFAULT true,
  send_email BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_perf_snapshots_project ON public.performance_snapshots(project_id, snapshot_date DESC);
CREATE INDEX idx_perf_alerts_project ON public.performance_alerts(project_id, status, created_at DESC);
CREATE INDEX idx_perf_predictions_project ON public.performance_predictions(project_id, prediction_date DESC);
CREATE INDEX idx_perf_thresholds_project ON public.performance_thresholds(project_id, is_active);

-- RLS
ALTER TABLE public.performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_thresholds ENABLE ROW LEVEL SECURITY;

-- RLS Policies - based on project membership
CREATE POLICY "Users can view performance snapshots for their projects"
  ON public.performance_snapshots FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "Project editors can insert performance snapshots"
  ON public.performance_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.can_create_asset_in_project(project_id, auth.uid()));

CREATE POLICY "Project editors can update performance snapshots"
  ON public.performance_snapshots FOR UPDATE TO authenticated
  USING (public.can_create_asset_in_project(project_id, auth.uid()));

CREATE POLICY "Project admins can delete performance snapshots"
  ON public.performance_snapshots FOR DELETE TO authenticated
  USING (public.has_project_permission(project_id, auth.uid(), 'settings', 'admin'));

-- Alerts policies
CREATE POLICY "Users can view alerts for their projects"
  ON public.performance_alerts FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "System/editors can insert alerts"
  ON public.performance_alerts FOR INSERT TO authenticated
  WITH CHECK (public.can_create_asset_in_project(project_id, auth.uid()));

CREATE POLICY "Users can update alerts they can view"
  ON public.performance_alerts FOR UPDATE TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

-- Predictions policies
CREATE POLICY "Users can view predictions for their projects"
  ON public.performance_predictions FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "System can insert predictions"
  ON public.performance_predictions FOR INSERT TO authenticated
  WITH CHECK (public.can_create_asset_in_project(project_id, auth.uid()));

-- Thresholds policies
CREATE POLICY "Users can view thresholds for their projects"
  ON public.performance_thresholds FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "Editors can manage thresholds"
  ON public.performance_thresholds FOR INSERT TO authenticated
  WITH CHECK (public.can_create_asset_in_project(project_id, auth.uid()));

CREATE POLICY "Editors can update thresholds"
  ON public.performance_thresholds FOR UPDATE TO authenticated
  USING (public.can_create_asset_in_project(project_id, auth.uid()));

CREATE POLICY "Editors can delete thresholds"
  ON public.performance_thresholds FOR DELETE TO authenticated
  USING (public.can_create_asset_in_project(project_id, auth.uid()));
