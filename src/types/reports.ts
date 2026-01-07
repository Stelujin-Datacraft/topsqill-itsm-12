
import { Json } from '@/integrations/supabase/types';

export interface Report {
  id: string;
  name: string;
  description?: string;
  project_id: string;
  organization_id?: string;
  created_by: string;
  is_public?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReportComponent {
  id: string;
  report_id: string;
  type: 'chart' | 'table' | 'metric-card' | 'text' | 'spacer' | 'form-submissions' | 'dynamic-table';
  config: ReportConfig;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  created_at: string;
  updated_at: string;
}

export interface ChartConfig {
  formId: string;
  chartType: 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'bubble' | 'heatmap';
  title: string;
  description?: string;
  xAxis?: string;
  yAxis?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  dimensions?: string[];
  metrics?: string[];
  aggregationType?: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'median' | 'stddev';
  aggregationEnabled?: boolean;
  compareMode?: boolean; // When true, show raw values of two fields side-by-side without aggregation
  encodedLegendMode?: boolean; // When true, encode second field values as numbers with legend
  groupByField?: string;
  colorTheme: 'default' | 'vibrant' | 'pastel' | 'monochrome' | 'custom';
  customColors?: string[];
  filters?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  // Chart-specific configurations
  innerRadius?: number; // For donut charts
  sizeField?: string; // For bubble charts
  heatmapIntensityField?: string; // For heatmap
  gridColumns?: number; // For heatmap
  gridRows?: number; // For heatmap
  maxDataPoints?: number; // Limit number of data points shown on chart
  
  // Enhanced configurations
  enableMultipleMetrics?: boolean;
  metricAggregations?: Array<{
    field: string;
    aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'median' | 'stddev';
  }>;
  
  // Display options
  showAsTable?: boolean;
  
  // Drilldown configuration
  drilldownConfig?: {
    enabled: boolean;
    drilldownLevels?: string[];
    levels?: string[]; // Legacy property name - kept for backwards compatibility
  };
  drilldownEnabled?: boolean;
  drilldownLevels?: string[];
  
  // Join configuration for combining data from multiple forms
  joinConfig?: {
    enabled: boolean;
    secondaryFormId: string;
    joinType: 'inner' | 'left' | 'right' | 'full';
    primaryFieldId: string;
    secondaryFieldId: string;
  };
  
  // Cross-reference configuration for using cross-reference field data in charts
  crossRefConfig?: {
    enabled: boolean;
    crossRefFieldId: string; // The cross-reference field in the main form
    targetFormId: string; // The form being referenced
    mode: 'count' | 'aggregate' | 'compare'; // Count linked records, aggregate their data, or compare two fields
    targetMetricFieldId?: string; // For aggregate mode: which field to aggregate
    targetAggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
    targetDimensionFieldId?: string; // For grouping by a field in the referenced form
    sourceLabelFieldId?: string; // Field from source form to use as chart label (instead of ref ID)
    // Compare mode specific - X/Y axis style like normal compare mode
    compareXFieldId?: string; // X-axis field (from target form)
    compareYFieldId?: string; // Y-axis field (from target form) - supports text with legend
    showRecordsSeparately?: boolean; // Show bars grouped by parent record in compare mode
    showLegendSidebar?: boolean; // Show legend sidebar for text Y-axis (default: true)
    // Group by source field
    sourceGroupByFieldId?: string; // Group chart data by a field from the source form
    // Drilldown configuration - like normal drilldown with levels and filters
    drilldownEnabled?: boolean; // Enable drill-down to view linked records
    drilldownLevels?: string[]; // Field IDs from target form for hierarchical drilldown
    drilldownDisplayFields?: string[]; // Fields to show in drilldown dialog
  };
  
  // Fields to display when clicking on chart elements
  displayFields?: string[];
  
  [key: string]: any;
}

export interface TableConfig {
  formId: string;
  title: string;
  description?: string;
  columns: Array<{
    fieldId: string;
    label: string;
    visible: boolean;
    sortable: boolean;
    filterable: boolean;
  }>;
  selectedColumns: string[];
  showMetadata: boolean;
  tableTheme: 'default' | 'striped' | 'bordered' | 'compact';
  filters?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  sorting?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  pagination?: {
    enabled: boolean;
    pageSize: number;
  };
  searchable?: boolean;
  exportable?: boolean;
  [key: string]: any;
}

export interface DynamicTableConfig {
  title: string;
  type: 'dynamic-table';
  formId: string;
  selectedColumns: string[];
  showMetadata: boolean;
  pageSize: number;
  enableSearch: boolean;
  enableSorting: boolean;
  enableFiltering: boolean;
  enableExport: boolean;
  filters: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  joinConfig?: {
    enabled: boolean;
    secondaryFormId: string;
    joinType: 'inner' | 'left' | 'right' | 'full';
    primaryFieldId: string;
    secondaryFieldId: string;
  };
  [key: string]: any;
}

export interface FormSubmissionsTableConfig {
  title: string;
  formId: string;
  selectedColumns: string[];
  showApprovalStatus: boolean;
  pageSize: number;
  type?: string;
  [key: string]: any;
}

export interface MetricConfig {
  formId: string;
  title: string;
  description?: string;
  field: string;
  metric: 'count' | 'sum' | 'avg' | 'min' | 'max';
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  format?: 'number' | 'currency' | 'percentage';
  icon?: string;
  color?: string;
  filters?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  [key: string]: any;
}

export interface MetricCardConfig {
  title: string;
  value: number | string;
  description?: string;
  icon?: string;
  color?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  format?: 'number' | 'currency' | 'percentage';
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  [key: string]: any;
}

export interface TextConfig {
  content: string;
  fontSize?: 'small' | 'medium' | 'large' | 'xl' | '2xl';
  fontWeight?: 'normal' | 'bold' | 'semibold';
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  backgroundColor?: string;
  padding?: 'none' | 'small' | 'medium' | 'large';
  [key: string]: any;
}

// Embedded chart configuration for cross-reference fields
export interface EmbeddedChartConfig {
  enabled: boolean;
  chartType: 'bar' | 'line' | 'area' | 'pie' | 'donut';
  mode: 'count' | 'calculate' | 'compare';
  title?: string;
  // Count mode: group by field
  groupByFieldId?: string;
  stackByFieldId?: string;
  // Calculate mode: numeric field with aggregation
  metricFieldId?: string;
  aggregationType?: 'sum' | 'avg' | 'min' | 'max' | 'median';
  // Compare mode: two fields side by side
  compareXFieldId?: string;
  compareYFieldId?: string;
  // Display options
  colorTheme?: 'default' | 'vibrant' | 'pastel' | 'monochrome';
  height?: number; // Chart height in pixels
}

export type ReportConfig = ChartConfig | TableConfig | MetricConfig | TextConfig | FormSubmissionsTableConfig | MetricCardConfig | DynamicTableConfig | Record<string, any>;

export interface ReportAccess {
  id: string;
  report_id: string;
  user_id: string;
  access_level: 'view' | 'edit' | 'admin';
  granted_by: string;
  granted_at: string;
}
