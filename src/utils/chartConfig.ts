
import { FormField } from '@/types/form';

export interface ChartTypeOption {
  value: string;
  label: string;
  description: string;
  supportedMetrics: number;
  supportedDimensions: number;
}

export interface ChartFieldOption {
  id: string;
  label: string;
  type: string;
  canBeMetric: boolean;
  canBeDimension: boolean;
}

export interface AggregationOption {
  value: string;
  label: string;
  description: string;
}

export const CHART_TYPES: ChartTypeOption[] = [
  {
    value: 'bar',
    label: 'Bar Chart',
    description: 'Compare values across categories',
    supportedMetrics: 3,
    supportedDimensions: 2
  },
  {
    value: 'column',
    label: 'Column Chart',
    description: 'Vertical bar chart',
    supportedMetrics: 3,
    supportedDimensions: 2
  },
  {
    value: 'line',
    label: 'Line Chart',
    description: 'Show trends over time',
    supportedMetrics: 3,
    supportedDimensions: 1
  },
  {
    value: 'area',
    label: 'Area Chart',
    description: 'Filled line chart',
    supportedMetrics: 3,
    supportedDimensions: 1
  },
  {
    value: 'pie',
    label: 'Pie Chart',
    description: 'Show parts of a whole',
    supportedMetrics: 1,
    supportedDimensions: 1
  },
  {
    value: 'donut',
    label: 'Donut Chart',
    description: 'Pie chart with hollow center',
    supportedMetrics: 1,
    supportedDimensions: 1
  },
  {
    value: 'scatter',
    label: 'Scatter Plot',
    description: 'Show correlation between variables',
    supportedMetrics: 2,
    supportedDimensions: 0
  },
  {
    value: 'bubble',
    label: 'Bubble Chart',
    description: 'Scatter plot with size dimension',
    supportedMetrics: 3,
    supportedDimensions: 1
  },
  {
    value: 'heatmap',
    label: 'Heatmap',
    description: 'Show intensity across dimensions',
    supportedMetrics: 1,
    supportedDimensions: 2
  },
  {
    value: 'table',
    label: 'Table',
    description: 'Tabular data display',
    supportedMetrics: 0,
    supportedDimensions: 0
  }
];

export const AGGREGATIONS: AggregationOption[] = [
  {
    value: 'count',
    label: 'Count',
    description: 'Count the number of records'
  },
  {
    value: 'sum',
    label: 'Sum',
    description: 'Add up all values'
  },
  {
    value: 'avg',
    label: 'Average',
    description: 'Calculate the average value'
  },
  {
    value: 'min',
    label: 'Minimum',
    description: 'Find the smallest value'
  },
  {
    value: 'max',
    label: 'Maximum',
    description: 'Find the largest value'
  }
];

export const JOIN_TYPES = [
  {
    value: 'inner',
    label: 'Inner Join',
    description: 'Returns records that have matching values in both forms'
  },
  {
    value: 'left',
    label: 'Left Join',
    description: 'Returns all records from the primary form, and matched records from the secondary form'
  },
  {
    value: 'right',
    label: 'Right Join',
    description: 'Returns all records from the secondary form, and matched records from the primary form'
  },
  {
    value: 'full',
    label: 'Full Outer Join',
    description: 'Returns all records when there is a match in either form'
  }
];

export const categorizeFields = (formFields: FormField[]): ChartFieldOption[] => {
  return formFields.map(field => {
    const canBeMetric = ['number', 'currency', 'rating', 'slider'].includes(field.type);
    const canBeDimension = ['text', 'email', 'select', 'radio', 'date', 'datetime'].includes(field.type);
    
    return {
      id: field.id,
      label: field.label,
      type: field.type,
      canBeMetric,
      canBeDimension
    };
  });
};

export const getCompatibleAggregations = (fieldType: string): AggregationOption[] => {
  if (['number', 'currency', 'rating', 'slider'].includes(fieldType)) {
    return AGGREGATIONS;
  }
  
  // For non-numeric fields, only count makes sense
  return AGGREGATIONS.filter(agg => agg.value === 'count');
};

export const canFieldsBeJoined = (field1: FormField, field2: FormField): boolean => {
  // Define which field types can be joined together
  const joinableTypes = [
    'text', 'email', 'number', 'select', 'radio', 'user-picker'
  ];
  
  // Both fields must be of joinable types
  if (!joinableTypes.includes(field1.type) || !joinableTypes.includes(field2.type)) {
    return false;
  }
  
  // Same types can always be joined
  if (field1.type === field2.type) {
    return true;
  }
  
  // Text and email can be joined
  if ((field1.type === 'text' && field2.type === 'email') || 
      (field1.type === 'email' && field2.type === 'text')) {
    return true;
  }
  
  // Select and radio can be joined if they have similar options
  if ((field1.type === 'select' && field2.type === 'radio') || 
      (field1.type === 'radio' && field2.type === 'select')) {
    return true;
  }
  
  return false;
};

export const getFilterOperatorsForFieldType = (fieldType: string) => {
  const commonOperators = ['equals', 'not_equals', 'is_empty', 'is_not_empty'];
  
  switch (fieldType) {
    case 'text':
    case 'email':
    case 'textarea':
      return [
        ...commonOperators,
        'contains',
        'not_contains',
        'starts_with',
        'ends_with'
      ];
    
    case 'number':
    case 'currency':
      return [
        ...commonOperators,
        'greater_than',
        'less_than',
        'between'
      ];
    
    case 'date':
    case 'datetime':
      return [
        ...commonOperators,
        'greater_than',
        'less_than',
        'between'
      ];
    
    case 'select':
    case 'radio':
    case 'multi-select':
      return [
        ...commonOperators,
        'in',
        'not_in'
      ];
    
    case 'checkbox':
    case 'toggle-switch':
      return ['equals', 'not_equals'];
    
    default:
      return commonOperators;
  }
};
