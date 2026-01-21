export type FilterOperator = 
  // Universal operators
  | 'equals' 
  | 'not_equals' 
  | 'is_empty' 
  | 'is_not_empty'
  // Text operators
  | 'contains' 
  | 'not_contains' 
  | 'starts_with' 
  | 'ends_with' 
  // Number/Date operators
  | 'greater_than' 
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  // Date-specific operators
  | 'before'
  | 'after'
  | 'on_or_before'
  | 'on_or_after'
  // Boolean operators
  | 'is_true'
  | 'is_false'
  // Selection operators
  | 'in'
  | 'not_in';

export interface SourceFilter {
  id?: string; // Unique ID for logic expressions
  fieldId: string;
  fieldName?: string;
  fieldType?: string; // Track field type for operator/input selection
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
  // For selecting which linked record to use when multiple are linked
  crossRefMatchType?: 'first' | 'static_value' | 'source_field'; // 'first' = use first record, 'static_value' = match by static value, 'source_field' = match by source field comparison
  crossRefMatchFieldId?: string; // The field in the linked form to match against
  crossRefMatchFieldName?: string;
  crossRefMatchValue?: string; // Static value to match (when crossRefMatchType = 'static_value')
  crossRefMatchSourceFieldId?: string; // Source field to compare against (when crossRefMatchType = 'source_field')
  crossRefMatchSourceFieldName?: string;
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

// Field type categories for operator selection
export type FieldCategory = 'text' | 'number' | 'date' | 'time' | 'boolean' | 'selection' | 'other';

export const getFieldCategory = (fieldType: string): FieldCategory => {
  switch (fieldType) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'phone':
    case 'url':
    case 'rich-text':
      return 'text';
    case 'number':
    case 'slider':
    case 'currency':
      return 'number';
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'checkbox':
    case 'toggle':
      return 'boolean';
    case 'dropdown':
    case 'radio':
    case 'multi-select':
    case 'lifecycle':
      return 'selection';
    default:
      return 'other';
  }
};

export interface FilterOperatorOption {
  value: FilterOperator;
  label: string;
  categories: FieldCategory[];
  requiresValue: boolean;
}

export const FILTER_OPERATORS: FilterOperatorOption[] = [
  // Universal operators
  { value: 'equals', label: 'Equals', categories: ['text', 'number', 'date', 'time', 'selection', 'other'], requiresValue: true },
  { value: 'not_equals', label: 'Not Equals', categories: ['text', 'number', 'date', 'time', 'selection', 'other'], requiresValue: true },
  { value: 'is_empty', label: 'Is Empty', categories: ['text', 'number', 'date', 'time', 'boolean', 'selection', 'other'], requiresValue: false },
  { value: 'is_not_empty', label: 'Is Not Empty', categories: ['text', 'number', 'date', 'time', 'boolean', 'selection', 'other'], requiresValue: false },
  
  // Text operators
  { value: 'contains', label: 'Contains', categories: ['text'], requiresValue: true },
  { value: 'not_contains', label: 'Does Not Contain', categories: ['text'], requiresValue: true },
  { value: 'starts_with', label: 'Starts With', categories: ['text'], requiresValue: true },
  { value: 'ends_with', label: 'Ends With', categories: ['text'], requiresValue: true },
  
  // Number operators
  { value: 'greater_than', label: 'Greater Than', categories: ['number'], requiresValue: true },
  { value: 'less_than', label: 'Less Than', categories: ['number'], requiresValue: true },
  { value: 'greater_than_or_equal', label: 'Greater Than or Equal', categories: ['number'], requiresValue: true },
  { value: 'less_than_or_equal', label: 'Less Than or Equal', categories: ['number'], requiresValue: true },
  
  // Date operators
  { value: 'before', label: 'Before', categories: ['date', 'time'], requiresValue: true },
  { value: 'after', label: 'After', categories: ['date', 'time'], requiresValue: true },
  { value: 'on_or_before', label: 'On or Before', categories: ['date'], requiresValue: true },
  { value: 'on_or_after', label: 'On or After', categories: ['date'], requiresValue: true },
  
  // Boolean operators
  { value: 'is_true', label: 'Is True', categories: ['boolean'], requiresValue: false },
  { value: 'is_false', label: 'Is False', categories: ['boolean'], requiresValue: false },
  
  // Selection operators
  { value: 'in', label: 'Is One Of', categories: ['selection'], requiresValue: true },
  { value: 'not_in', label: 'Is Not One Of', categories: ['selection'], requiresValue: true },
];

export const getOperatorsForFieldType = (fieldType: string): FilterOperatorOption[] => {
  const category = getFieldCategory(fieldType);
  return FILTER_OPERATORS.filter(op => op.categories.includes(category));
};

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
