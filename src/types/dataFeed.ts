export type FilterOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'not_contains' 
  | 'starts_with' 
  | 'ends_with' 
  | 'greater_than' 
  | 'less_than' 
  | 'is_empty' 
  | 'is_not_empty';

export interface SourceFilter {
  id?: string; // Unique ID for logic expressions
  fieldId: string;
  fieldName?: string;
  operator: FilterOperator;
  value: string; // Static value to compare against
}

export interface FieldMapping {
  sourceFieldId: string;
  targetFieldId: string;
  sourceFieldName?: string;
  targetFieldName?: string;
  // For cross-reference field mapping
  sourceType?: 'direct' | 'cross_reference'; // 'direct' = from source form, 'cross_reference' = from linked record
  crossRefFieldId?: string; // The cross-reference field in source form
  crossRefFieldName?: string;
  crossRefSourceFieldId?: string; // The field from the cross-referenced form to pull data from
  crossRefSourceFieldName?: string;
}

export interface MatchingRule {
  id?: string; // Unique ID for logic expressions
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
  matching_logic?: string; // Logic expression e.g. "1 AND 2", "(1 OR 2) AND 3"
  source_filters?: SourceFilter[]; // Filters to apply to source records
  source_filter_logic?: string; // Logic expression for source filters
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
    recordsFiltered: number; // New: count of records filtered out by source filters
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
  matching_logic?: string; // Logic expression e.g. "1 AND 2", "(1 OR 2) AND 3"
  source_filters?: SourceFilter[]; // Filters to apply to source records
  source_filter_logic?: string; // Logic expression for source filters
  field_mappings: FieldMapping[];
  no_match_behavior: 'skip' | 'create';
  schedule?: string;
  is_active: boolean;
}

export const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Not Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

export const SCHEDULE_PRESETS = [
  { label: 'Every 15 minutes', value: '*/15 * * * *', category: 'frequent' },
  { label: 'Every 30 minutes', value: '*/30 * * * *', category: 'frequent' },
  { label: 'Every hour', value: '0 * * * *', category: 'frequent' },
  { label: 'Every 2 hours', value: '0 */2 * * *', category: 'hourly' },
  { label: 'Every 4 hours', value: '0 */4 * * *', category: 'hourly' },
  { label: 'Every 6 hours', value: '0 */6 * * *', category: 'hourly' },
  { label: 'Every 12 hours', value: '0 */12 * * *', category: 'hourly' },
  { label: 'Daily at midnight', value: '0 0 * * *', category: 'daily' },
  { label: 'Daily at 6 AM', value: '0 6 * * *', category: 'daily' },
  { label: 'Daily at 9 AM', value: '0 9 * * *', category: 'daily' },
  { label: 'Daily at 12 PM', value: '0 12 * * *', category: 'daily' },
  { label: 'Daily at 6 PM', value: '0 18 * * *', category: 'daily' },
  { label: 'Weekly on Monday', value: '0 0 * * 1', category: 'weekly' },
  { label: 'Weekly on Friday', value: '0 0 * * 5', category: 'weekly' },
  { label: 'Weekly on Sunday', value: '0 0 * * 0', category: 'weekly' },
  { label: 'Bi-weekly (1st & 15th)', value: '0 0 1,15 * *', category: 'monthly' },
  { label: 'Monthly (1st)', value: '0 0 1 * *', category: 'monthly' },
  { label: 'Monthly (Last day)', value: '0 0 L * *', category: 'monthly' },
  { label: 'Quarterly (Jan, Apr, Jul, Oct)', value: '0 0 1 1,4,7,10 *', category: 'monthly' },
];

export interface ScheduleConfig {
  type: 'preset' | 'custom' | 'interval';
  preset?: string;
  customCron?: string;
  intervalValue?: number;
  intervalUnit?: 'minutes' | 'hours' | 'days';
  atTime?: string; // HH:mm format for daily/weekly schedules
  onDays?: number[]; // 0-6 for days of week (0 = Sunday)
}

export const buildCronFromConfig = (config: ScheduleConfig): string => {
  if (config.type === 'preset' && config.preset) {
    return config.preset;
  }
  
  if (config.type === 'custom' && config.customCron) {
    return config.customCron;
  }
  
  if (config.type === 'interval' && config.intervalValue && config.intervalUnit) {
    const value = config.intervalValue;
    switch (config.intervalUnit) {
      case 'minutes':
        return `*/${value} * * * *`;
      case 'hours':
        return `0 */${value} * * *`;
      case 'days':
        const [hours, minutes] = (config.atTime || '00:00').split(':').map(Number);
        if (config.onDays && config.onDays.length > 0 && config.onDays.length < 7) {
          return `${minutes} ${hours} * * ${config.onDays.join(',')}`;
        }
        return `${minutes} ${hours} */${value} * *`;
      default:
        return '';
    }
  }
  
  return '';
};

export const parseCronToReadable = (cron: string): string => {
  if (!cron) return 'No schedule';
  
  const preset = SCHEDULE_PRESETS.find(p => p.value === cron);
  if (preset) return preset.label;
  
  // Basic parsing for common patterns
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  if (minute.startsWith('*/')) {
    return `Every ${minute.slice(2)} minutes`;
  }
  if (hour.startsWith('*/') && minute === '0') {
    return `Every ${hour.slice(2)} hours`;
  }
  if (dayOfMonth.startsWith('*/') && minute !== '*' && hour !== '*') {
    return `Every ${dayOfMonth.slice(2)} days at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }
  
  return cron;
};
