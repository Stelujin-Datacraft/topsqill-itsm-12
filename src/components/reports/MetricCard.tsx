
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
import { getFieldType } from '@/data/fieldTypeMapping';

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

export function MetricCard({ config, isEditing, onConfigChange, onEdit }: MetricCardProps) {
  const [metricValue, setMetricValue] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  
  const { getFormSubmissionData, getFormFields, forms } = useReports();

  useEffect(() => {
    loadMetricData();
  }, [config.formId, config.field, config.aggregation, JSON.stringify(config.filters)]);

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
            const fieldValue = Number(submissionData[config.field]);
            return acc + (isNaN(fieldValue) ? 0 : fieldValue);
          }, 0);
          break;
        case 'avg':
          const sum = filteredSubmissions.reduce((acc, submission) => {
            const submissionData = submission.submission_data;
            const fieldValue = Number(submissionData[config.field]);
            return acc + (isNaN(fieldValue) ? 0 : fieldValue);
          }, 0);
          value = filteredSubmissions.length > 0 ? sum / filteredSubmissions.length : 0;
          break;
        case 'min':
          value = filteredSubmissions.reduce((min, submission) => {
            const submissionData = submission.submission_data;
            const fieldValue = Number(submissionData[config.field]);
            return Math.min(min, isNaN(fieldValue) ? Infinity : fieldValue);
          }, Infinity);
          value = value === Infinity ? 0 : value;
          break;
        case 'max':
          value = filteredSubmissions.reduce((max, submission) => {
            const submissionData = submission.submission_data;
            const fieldValue = Number(submissionData[config.field]);
            return Math.max(max, isNaN(fieldValue) ? -Infinity : fieldValue);
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
    if (!config.formId) return [];
    const fields = getFormFields(config.formId);
    // For count aggregation, we don't need to filter by field type
    // For other aggregations, filter to numeric-compatible fields
    if (config.aggregation === 'count') {
      return fields.map(field => ({
        id: field.id,
        label: field.label,
        type: getFieldType(field.type)
      }));
    }
    return fields.filter(field => {
      const fieldType = getFieldType(field.type);
      return fieldType === 'number' || fieldType === 'text' || fieldType === 'email' || fieldType === 'currency' || fieldType === 'slider' || fieldType === 'rating';
    }).map(field => ({
      id: field.id,
      label: field.label,
      type: getFieldType(field.type)
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
