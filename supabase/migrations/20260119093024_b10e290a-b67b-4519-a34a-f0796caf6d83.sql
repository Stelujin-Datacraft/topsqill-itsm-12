-- Create data_feeds table to store feed configurations
CREATE TABLE public.data_feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  
  -- Source and target forms
  source_form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  target_form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  
  -- Matching configuration
  matching_type TEXT NOT NULL DEFAULT 'field_matching', -- 'cross_reference' or 'field_matching'
  cross_reference_field_id UUID REFERENCES public.form_fields(id) ON DELETE SET NULL,
  matching_rules JSONB DEFAULT '[]'::jsonb, -- Array of {sourceFieldId, targetFieldId} for field matching
  
  -- Field mappings for data sync
  field_mappings JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {sourceFieldId, targetFieldId, sourceFieldName, targetFieldName}
  
  -- Behavior when no match found
  no_match_behavior TEXT NOT NULL DEFAULT 'skip', -- 'skip' or 'create'
  
  -- Schedule configuration (cron expression)
  schedule TEXT, -- e.g., '0 * * * *' for hourly, '0 0 * * *' for daily
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps and audit
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT, -- 'success', 'failed', 'partial'
  last_run_stats JSONB, -- {recordsProcessed, recordsUpdated, recordsCreated, errors}
  
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create data_feed_runs table to track execution history
CREATE TABLE public.data_feed_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_feed_id UUID NOT NULL REFERENCES public.data_feeds(id) ON DELETE CASCADE,
  
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Statistics
  records_processed INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  
  -- Detailed logs
  run_log JSONB DEFAULT '[]'::jsonb, -- Array of log entries
  error_details JSONB, -- Detailed error information
  
  triggered_by TEXT DEFAULT 'schedule' -- 'schedule', 'manual'
);

-- Enable RLS
ALTER TABLE public.data_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_feed_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for data_feeds
CREATE POLICY "Users can view data feeds in their projects"
  ON public.data_feeds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_users pu
      WHERE pu.project_id = data_feeds.project_id
      AND pu.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create data feeds in their projects"
  ON public.data_feeds FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_users pu
      WHERE pu.project_id = data_feeds.project_id
      AND pu.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update data feeds in their projects"
  ON public.data_feeds FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_users pu
      WHERE pu.project_id = data_feeds.project_id
      AND pu.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete data feeds in their projects"
  ON public.data_feeds FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_users pu
      WHERE pu.project_id = data_feeds.project_id
      AND pu.user_id = auth.uid()
    )
  );

-- RLS policies for data_feed_runs
CREATE POLICY "Users can view runs for their data feeds"
  ON public.data_feed_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM data_feeds df
      JOIN project_users pu ON pu.project_id = df.project_id
      WHERE df.id = data_feed_runs.data_feed_id
      AND pu.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert runs for their data feeds"
  ON public.data_feed_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM data_feeds df
      JOIN project_users pu ON pu.project_id = df.project_id
      WHERE df.id = data_feed_runs.data_feed_id
      AND pu.user_id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_data_feeds_updated_at
  BEFORE UPDATE ON public.data_feeds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_data_feeds_project ON public.data_feeds(project_id);
CREATE INDEX idx_data_feeds_source_form ON public.data_feeds(source_form_id);
CREATE INDEX idx_data_feeds_target_form ON public.data_feeds(target_form_id);
CREATE INDEX idx_data_feeds_active ON public.data_feeds(is_active) WHERE is_active = true;
CREATE INDEX idx_data_feed_runs_feed ON public.data_feed_runs(data_feed_id);
CREATE INDEX idx_data_feed_runs_status ON public.data_feed_runs(status);