export interface FieldMapping {
  sourceFieldId: string;
  targetFieldId: string;
  sourceFieldName?: string;
  targetFieldName?: string;
}

export interface MatchingRule {
  sourceFieldId: string;
  targetFieldId: string;
  sourceFieldName?: string;
  targetFieldName?: string;
}

export interface DataFeed {
  id: string;
  name: string;
  description?: string;
  project_id: string;
  organization_id?: string;
  source_form_id: string;
  target_form_id: string;
  matching_type: 'cross_reference' | 'field_matching';
  cross_reference_field_id?: string;
  matching_rules: MatchingRule[];
  field_mappings: FieldMapping[];
  no_match_behavior: 'skip' | 'create';
  schedule?: string;
  is_active: boolean;
  last_run_at?: string;
  last_run_status?: 'success' | 'failed' | 'partial';
  last_run_stats?: {
    recordsProcessed: number;
    recordsUpdated: number;
    recordsCreated: number;
    recordsSkipped: number;
    errors: number;
  };
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DataFeedRun {
  id: string;
  data_feed_id: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  records_processed: number;
  records_updated: number;
  records_created: number;
  records_skipped: number;
  errors_count: number;
  run_log: { type: string; message: string; timestamp: string }[];
  error_details?: any;
  triggered_by: 'schedule' | 'manual';
}

export interface DataFeedFormData {
  name: string;
  description?: string;
  source_form_id: string;
  target_form_id: string;
  matching_type: 'cross_reference' | 'field_matching';
  cross_reference_field_id?: string;
  matching_rules: MatchingRule[];
  field_mappings: FieldMapping[];
  no_match_behavior: 'skip' | 'create';
  schedule?: string;
  is_active: boolean;
}

export const SCHEDULE_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 9 AM', value: '0 9 * * *' },
  { label: 'Weekly (Monday)', value: '0 0 * * 1' },
  { label: 'Monthly (1st)', value: '0 0 1 * *' },
];
