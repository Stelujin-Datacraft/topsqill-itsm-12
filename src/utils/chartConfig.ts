import { FormField } from '@/types/form';

export const JOIN_TYPES = [
  { value: 'inner', label: 'Inner Join', description: 'Only matching records' },
  { value: 'left', label: 'Left Join', description: 'All from first form' },
  { value: 'right', label: 'Right Join', description: 'All from second form' },
  { value: 'full', label: 'Full Join', description: 'All records from both forms' }
];

export interface ChartTypeOption {
  value: string;
  label: string;
  icon: any;
  description: string;
  supportedMetrics?: number;
  supportedDimensions?: number;
}

export interface ChartFieldOption {
  id: string;
  label: string;
  type: string;
  category: string;
}

export interface AggregationOption {
  value: string;
  label: string;
  description?: string;
}

export const CHART_TYPES: ChartTypeOption[] = [
  { value: 'bar', label: 'Bar Chart', icon: null, description: 'Compare values across categories', supportedMetrics: 5, supportedDimensions: 2 },
  { value: 'column', label: 'Column Chart', icon: null, description: 'Vertical bar chart', supportedMetrics: 5, supportedDimensions: 2 },
  { value: 'line', label: 'Line Chart', icon: null, description: 'Show trends over time', supportedMetrics: 5, supportedDimensions: 1 },
  { value: 'area', label: 'Area Chart', icon: null, description: 'Filled line chart', supportedMetrics: 5, supportedDimensions: 1 },
  { value: 'pie', label: 'Pie Chart', icon: null, description: 'Show parts of a whole', supportedMetrics: 1, supportedDimensions: 1 },
  { value: 'donut', label: 'Donut Chart', icon: null, description: 'Pie chart with hollow center', supportedMetrics: 1, supportedDimensions: 1 },
  { value: 'scatter', label: 'Scatter Plot', icon: null, description: 'Show correlation between variables', supportedMetrics: 2, supportedDimensions: 1 },
  { value: 'bubble', label: 'Bubble Chart', icon: null, description: 'Scatter plot with size dimension', supportedMetrics: 3, supportedDimensions: 1 },
  { value: 'heatmap', label: 'Heatmap', icon: null, description: 'Show intensity across dimensions', supportedMetrics: 1, supportedDimensions: 2 },
  { value: 'table', label: 'Table', icon: null, description: 'Tabular data display', supportedMetrics: 10, supportedDimensions: 10 }
];

export function canFieldsBeJoined(field1: FormField, field2: FormField): boolean {
  // Fields can be joined if they have compatible types
  // Support both .type and .field_type properties for flexibility
  const getFieldType = (field: FormField): string => {
    return (field as any).field_type || field.type || '';
  };

  const type1 = getFieldType(field1);
  const type2 = getFieldType(field2);

  const compatibleTypes = [
    ['text', 'email', 'url', 'tel', 'header'],
    ['number', 'currency', 'rating'],
    ['select', 'radio', 'dropdown'],
    ['checkbox', 'multi-select'],
    ['date', 'datetime'],
    ['file'],
    ['textarea']
  ];

  // Check if both fields are in the same compatibility group
  for (const group of compatibleTypes) {
    if (group.includes(type1) && group.includes(type2)) {
      return true;
    }
  }

  // Also allow same-type matching
  if (type1 === type2) {
    return true;
  }

  return false;
}

export function getFieldDisplayName(field: FormField, formName?: string): string {
  return formName ? `${formName}.${field.label}` : field.label;
}

export function categorizeFields(fields: FormField[]): { [category: string]: ChartFieldOption[] } {
  const categories: { [category: string]: ChartFieldOption[] } = {
    dimensions: [],
    metrics: [],
    other: []
  };

  // Helper to get field type supporting both .type and .field_type
  const getFieldType = (field: FormField): string => {
    return (field as any).field_type || field.type || '';
  };

  fields.forEach(field => {
    const fieldType = getFieldType(field);
    const option: ChartFieldOption = {
      id: field.id,
      label: field.label,
      type: fieldType,
      category: ''
    };

    // Dimensions: Categorical data that can be used for grouping
    if (['text', 'select', 'radio', 'checkbox', 'date', 'datetime', 'email', 'url', 'tel', 'dropdown', 'multi-select'].includes(fieldType)) {
      option.category = 'dimensions';
      categories.dimensions.push(option);
    } 
    // Metrics: Numeric data that can be measured and aggregated
    else if (['number', 'currency', 'rating', 'slider'].includes(fieldType)) {
      option.category = 'metrics';
      categories.metrics.push(option);
    } 
    // Other fields that don't fit standard metric/dimension categories
    else {
      option.category = 'other';
      categories.other.push(option);
    }
  });

  return categories;
}

export function getMetricCompatibleFields(fields: FormField[]): FormField[] {
  return fields.filter(field => {
    // Support both .type and .field_type
    const fieldType = (field as any).field_type || field.type || '';
    return ['number', 'currency', 'rating', 'slider'].includes(fieldType);
  });
}

export function getDimensionCompatibleFields(fields: FormField[]): FormField[] {
  return fields.filter(field => {
    // Support both .type and .field_type
    const fieldType = (field as any).field_type || field.type || '';
    return ['text', 'select', 'radio', 'checkbox', 'date', 'datetime', 'email', 'url', 'tel', 'dropdown', 'multi-select'].includes(fieldType);
  });
}

export function getCompatibleAggregations(fieldType: string): AggregationOption[] {
  const allAggregations: AggregationOption[] = [
    { value: 'count', label: 'Count', description: 'Count of records' },
    { value: 'sum', label: 'Sum', description: 'Sum of values' },
    { value: 'avg', label: 'Average', description: 'Average value' },
    { value: 'min', label: 'Minimum', description: 'Minimum value' },
    { value: 'max', label: 'Maximum', description: 'Maximum value' },
    { value: 'median', label: 'Median', description: 'Median value' },
    { value: 'stddev', label: 'Standard Deviation', description: 'Standard deviation' }
  ];

  if (['number', 'currency', 'rating', 'slider'].includes(fieldType)) {
    return allAggregations;
  }

  // For non-numeric fields, only count makes sense
  return [allAggregations[0]];
}

export function getChartMetricCapabilities(chartType: string): { maxMetrics: number; maxDimensions: number } {
  const capabilities: { [key: string]: { maxMetrics: number; maxDimensions: number } } = {
    'bar': { maxMetrics: 5, maxDimensions: 2 },
    'column': { maxMetrics: 5, maxDimensions: 2 },
    'line': { maxMetrics: 5, maxDimensions: 1 },
    'area': { maxMetrics: 3, maxDimensions: 1 },
    'pie': { maxMetrics: 1, maxDimensions: 1 },
    'donut': { maxMetrics: 1, maxDimensions: 1 },
    'scatter': { maxMetrics: 2, maxDimensions: 1 },
    'bubble': { maxMetrics: 3, maxDimensions: 1 },
    'heatmap': { maxMetrics: 1, maxDimensions: 2 },
    'table': { maxMetrics: 10, maxDimensions: 10 }
  };
  
  return capabilities[chartType] || { maxMetrics: 1, maxDimensions: 1 };
}