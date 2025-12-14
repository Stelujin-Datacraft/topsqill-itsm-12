
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  TrendingUp, 
  TrendingDown, 
  Target,
  Activity,
  DollarSign,
  Users,
  BarChart3,
  Edit
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useReports } from '@/hooks/useReports';
import { supabase } from '@/integrations/supabase/client';

interface FormFieldData {
  id: string;
  label: string;
  field_type: string;
}

interface MetricCardConfig {
  title?: string;
  formId?: string;
  field?: string;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  filters?: Array<{ field: string; operator: string; value: any }>;
  layout?: { w: number; h: number };
}

interface MetricCardProps {
  config: MetricCardConfig;
  isEditing?: boolean;
  onConfigChange?: (config: MetricCardConfig) => void;
  onEdit?: () => void;
}

// Numeric field types that support aggregation functions (sum, avg, min, max)
const NUMERIC_FIELD_TYPES = ['number', 'currency', 'rating', 'star-rating', 'slider'];

export function MetricCard({ config, isEditing, onConfigChange, onEdit }: MetricCardProps) {
  const [metricValue, setMetricValue] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [formFields, setFormFields] = useState<FormFieldData[]>([]);
  
  const { getFormSubmissionData, forms } = useReports();

  // Fetch form fields directly from Supabase
  useEffect(() => {
    const fetchFormFields = async () => {
      if (!config.formId) {
        setFormFields([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', config.formId)
        .order('field_order', { ascending: true });
      
      if (error) {
        console.error('Error fetching form fields:', error);
        setFormFields([]);
        return;
      }
      
      setFormFields(data || []);
    };
    
    fetchFormFields();
  }, [config.formId]);

  useEffect(() => {
    loadMetricData();
  }, [config.formId, config.field, config.aggregation, JSON.stringify(config.filters), formFields]);

  // Extract numeric value from field data based on field type
  const extractNumericValue = (rawValue: any, fieldType?: string): number => {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return NaN;
    }

    // Currency field: stored as "USD:100" or { code: "USD", amount: 100 }
    if (fieldType === 'currency') {
      if (typeof rawValue === 'string' && rawValue.includes(':')) {
        const parts = rawValue.split(':');
        return parseFloat(parts[1]) || NaN;
      }
      if (typeof rawValue === 'object' && rawValue.amount !== undefined) {
        return parseFloat(rawValue.amount) || NaN;
      }
    }

    // Rating/star-rating/slider: direct numeric
    if (['rating', 'star-rating', 'slider', 'number'].includes(fieldType || '')) {
      return parseFloat(String(rawValue)) || NaN;
    }

    // Fallback: try to parse as number
    const parsed = parseFloat(String(rawValue));
    return isNaN(parsed) ? NaN : parsed;
  };

  const loadMetricData = async () => {
    if (!config.formId) {
      setLoading(false);
      return;
    }

    // For count aggregation, field is not required
    if (config.aggregation !== 'count' && !config.field) {
      setLoading(false);
      return;
    }

    try {
      const submissions = await getFormSubmissionData(config.formId);
      
      // Find the field type for the selected field from formFields state
      const selectedField = formFields.find(f => f.id === config.field);
      const fieldType = selectedField?.field_type;
      
      const filteredSubmissions = submissions.filter(submission => {
        const submissionData = submission.submission_data;
        return config.filters?.every(filter => {
          const value = submissionData[filter.field];
          switch (filter.operator) {
            case 'equals':
              return value === filter.value;
            case 'contains':
              return String(value).includes(filter.value);
            case 'greater_than':
              return Number(value) > Number(filter.value);
            case 'less_than':
              return Number(value) < Number(filter.value);
            default:
              return true;
          }
        }) ?? true;
      });

      let value = 0;
      switch (config.aggregation) {
        case 'count':
          value = filteredSubmissions.length;
          break;
        case 'sum':
          value = filteredSubmissions.reduce((acc, submission) => {
            const submissionData = submission.submission_data;
            const numValue = extractNumericValue(submissionData[config.field!], fieldType);
            return acc + (isNaN(numValue) ? 0 : numValue);
          }, 0);
          break;
        case 'avg':
          const validValues: number[] = [];
          filteredSubmissions.forEach(submission => {
            const submissionData = submission.submission_data;
            const numValue = extractNumericValue(submissionData[config.field!], fieldType);
            if (!isNaN(numValue)) {
              validValues.push(numValue);
            }
          });
          value = validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : 0;
          break;
        case 'min':
          value = filteredSubmissions.reduce((min, submission) => {
            const submissionData = submission.submission_data;
            const numValue = extractNumericValue(submissionData[config.field!], fieldType);
            return Math.min(min, isNaN(numValue) ? Infinity : numValue);
          }, Infinity);
          value = value === Infinity ? 0 : value;
          break;
        case 'max':
          value = filteredSubmissions.reduce((max, submission) => {
            const submissionData = submission.submission_data;
            const numValue = extractNumericValue(submissionData[config.field!], fieldType);
            return Math.max(max, isNaN(numValue) ? -Infinity : numValue);
          }, -Infinity);
          value = value === -Infinity ? 0 : value;
          break;
        default:
          value = 0;
      }

      setMetricValue(value);
    } catch (error) {
      console.error('Error loading metric data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableFields = () => {
    if (!config.formId || formFields.length === 0) return [];
    
    // For count aggregation, all fields are valid
    if (config.aggregation === 'count') {
      return formFields.map(field => ({
        id: field.id,
        label: field.label,
        type: field.field_type
      }));
    }
    
    // For other aggregations (sum, avg, min, max), only numeric fields
    return formFields.filter(field => {
      return NUMERIC_FIELD_TYPES.includes(field.field_type);
    }).map(field => ({
      id: field.id,
      label: field.label,
      type: field.field_type
    }));
  };

  const getIcon = () => {
    switch (config.aggregation) {
      case 'count':
        return <Users className="h-4 w-4 mr-2" />;
      case 'sum':
        return <DollarSign className="h-4 w-4 mr-2" />;
      case 'avg':
        return <BarChart3 className="h-4 w-4 mr-2" />;
      case 'min':
        return <TrendingDown className="h-4 w-4 mr-2" />;
      case 'max':
        return <TrendingUp className="h-4 w-4 mr-2" />;
      default:
        return <Target className="h-4 w-4 mr-2" />;
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-4 p-6 border-2 border-violet-200 rounded-lg bg-white shadow-sm">
        <div>
          <Label className="text-slate-700 font-medium">Title</Label>
          <Input
            value={config.title || ''}
            onChange={(e) => onConfigChange?.({ ...config, title: e.target.value })}
            placeholder="Enter metric title"
            className="mt-1 border-slate-200 focus:border-violet-400"
          />
        </div>

        <div>
          <Label className="text-slate-700 font-medium">Table (Form)</Label>
          <Select 
            value={config.formId} 
            onValueChange={(value) => onConfigChange?.({ ...config, formId: value })}
          >
            <SelectTrigger className="mt-1 border-slate-200 focus:border-violet-400">
              <SelectValue placeholder="Select table/form" />
            </SelectTrigger>
            <SelectContent>
              {forms.map(form => (
                <SelectItem key={form.id} value={form.id}>
                  {form.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-slate-700 font-medium">Column (Field)</Label>
          <Select 
            value={config.field} 
            onValueChange={(value) => onConfigChange?.({ ...config, field: value })}
          >
            <SelectTrigger className="mt-1 border-slate-200 focus:border-violet-400">
              <SelectValue placeholder="Select column/field" />
            </SelectTrigger>
            <SelectContent>
              {getAvailableFields().map(field => (
                <SelectItem key={field.id} value={field.id}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-slate-700 font-medium">Function (Aggregation)</Label>
          <Select 
            value={config.aggregation} 
            onValueChange={(value) => onConfigChange?.({ ...config, aggregation: value as any })}
          >
            <SelectTrigger className="mt-1 border-slate-200 focus:border-violet-400">
              <SelectValue placeholder="Select function" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="count">Count</SelectItem>
              <SelectItem value="sum">Sum</SelectItem>
              <SelectItem value="avg">Average</SelectItem>
              <SelectItem value="min">Minimum</SelectItem>
              <SelectItem value="max">Maximum</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 bg-white rounded-lg border border-slate-200">
        <div className="text-slate-500">Loading metric data...</div>
      </div>
    );
  }

  return (
    <Card className="bg-white border border-slate-200 shadow-lg hover:shadow-xl transition-shadow relative group">
      {onEdit && (
        <Button
          size="sm"
          variant="outline"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={onEdit}
        >
          <Edit className="h-4 w-4" />
        </Button>
      )}
      <CardHeader>
        <CardTitle className="flex items-center text-slate-900">
          {getIcon()}
          {config.title || 'Metric'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900">{metricValue.toLocaleString()}</div>
        <div className="text-sm text-slate-500 flex items-center mt-2">
          <Activity className="h-4 w-4 mr-1" />
          Real-time
        </div>
      </CardContent>
    </Card>
  );
}
