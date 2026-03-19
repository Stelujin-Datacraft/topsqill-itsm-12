import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, Settings2, FileText } from 'lucide-react';

interface DataSourceOption {
  id: string;
  source_form_name: string;
  field_mappings: Array<{
    formFieldId: string;
    formFieldLabel: string;
    formFieldType: string;
    metricRole: string;
    label: string;
  }>;
}

const STATIC_METRIC_OPTIONS = [
  { value: 'budget_variance', label: 'Budget Variance ($)' },
  { value: 'budget_variance_pct', label: 'Budget Variance (%)' },
  { value: 'schedule_variance_days', label: 'Schedule Variance (days)' },
  { value: 'completion_pct', label: 'Completion %' },
  { value: 'resource_utilization_pct', label: 'Resource Utilization %' },
  { value: 'blocked_tasks', label: 'Blocked Tasks' },
  { value: 'overdue_milestones', label: 'Overdue Milestones' },
  { value: 'risk_score', label: 'Risk Score' },
];

export function ThresholdsConfig() {
  const { thresholds, loading, createThreshold, deleteThreshold } = usePerformanceMonitoring();
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [open, setOpen] = useState(false);
  const [metricSource, setMetricSource] = useState<'static' | 'form'>('static');
  const [selectedDataSourceId, setSelectedDataSourceId] = useState('');
  const [formData, setFormData] = useState({
    metric_name: 'budget_variance',
    operator: '>',
    threshold_value: 0,
    severity: 'medium',
    send_email: false,
    form_field_id: '',
    form_field_label: '',
    data_limit: 100,
  });

  // Fetch data sources for form-based thresholds
  const { data: dataSources = [] } = useQuery({
    queryKey: ['performance-data-sources', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('performance_data_sources')
        .select('id, source_form_name, field_mappings')
        .eq('project_id', projectId)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        field_mappings: Array.isArray(d.field_mappings) ? d.field_mappings : [],
      })) as DataSourceOption[];
    },
    enabled: !!projectId,
  });

  const selectedDataSource = dataSources.find(ds => ds.id === selectedDataSourceId);
  const numericMappings = (selectedDataSource?.field_mappings || []).filter(
    (m: any) => m.metricRole === 'numeric_metric'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const thresholdData: any = {
      metric_name: metricSource === 'form' ? formData.form_field_id : formData.metric_name,
      operator: formData.operator,
      threshold_value: formData.threshold_value,
      severity: formData.severity,
      send_email: formData.send_email,
    };
    if (metricSource === 'form') {
      thresholdData.data_source_id = selectedDataSourceId;
      thresholdData.form_field_id = formData.form_field_id;
      thresholdData.form_field_label = formData.form_field_label;
      thresholdData.data_limit = formData.data_limit;
    }
    await createThreshold.mutateAsync(thresholdData);
    setOpen(false);
    setFormData({
      metric_name: 'budget_variance', operator: '>', threshold_value: 0,
      severity: 'medium', send_email: false, form_field_id: '', form_field_label: '', data_limit: 100,
    });
    setMetricSource('static');
    setSelectedDataSourceId('');
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 text-red-600';
      case 'high': return 'bg-orange-500/10 text-orange-600';
      case 'medium': return 'bg-yellow-500/10 text-yellow-600';
      case 'low': return 'bg-blue-500/10 text-blue-600';
      default: return '';
    }
  };

  const getMetricLabel = (threshold: any) => {
    if (threshold.form_field_label) return threshold.form_field_label;
    return STATIC_METRIC_OPTIONS.find(m => m.value === threshold.metric_name)?.label || threshold.metric_name;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Alert Thresholds</h2>
          <p className="text-sm text-muted-foreground">
            Configure automatic alert triggers for performance metrics or form field values
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Threshold</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Alert Threshold</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Source Toggle */}
              <div className="space-y-2">
                <Label>Metric Source</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={metricSource === 'static' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMetricSource('static')}
                  >
                    <Settings2 className="h-3.5 w-3.5 mr-1" /> Static Metrics
                  </Button>
                  <Button
                    type="button"
                    variant={metricSource === 'form' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMetricSource('form')}
                    disabled={dataSources.length === 0}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" /> Form Field
                  </Button>
                </div>
                {dataSources.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Add a data source first to use form-based thresholds.
                  </p>
                )}
              </div>

              {metricSource === 'static' ? (
                <div>
                  <Label>Metric</Label>
                  <Select
                    value={formData.metric_name}
                    onValueChange={v => setFormData(p => ({ ...p, metric_name: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATIC_METRIC_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div>
                    <Label>Data Source</Label>
                    <Select value={selectedDataSourceId} onValueChange={setSelectedDataSourceId}>
                      <SelectTrigger><SelectValue placeholder="Select data source..." /></SelectTrigger>
                      <SelectContent>
                        {dataSources.map(ds => (
                          <SelectItem key={ds.id} value={ds.id}>{ds.source_form_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {numericMappings.length > 0 && (
                    <div>
                      <Label>Form Field</Label>
                      <Select
                        value={formData.form_field_id}
                        onValueChange={v => {
                          const mapping = numericMappings.find((m: any) => m.formFieldId === v);
                          setFormData(p => ({
                            ...p,
                            form_field_id: v,
                            form_field_label: mapping?.label || mapping?.formFieldLabel || '',
                          }));
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Select field..." /></SelectTrigger>
                        <SelectContent>
                          {numericMappings.map((m: any) => (
                            <SelectItem key={m.formFieldId} value={m.formFieldId}>
                              {m.label || m.formFieldLabel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>Data Limit</Label>
                    <Input
                      type="number"
                      min={10}
                      max={1000}
                      value={formData.data_limit}
                      onChange={e => setFormData(p => ({ ...p, data_limit: parseInt(e.target.value) || 100 }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Max records to evaluate (10-1000)</p>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Operator</Label>
                  <Select value={formData.operator} onValueChange={v => setFormData(p => ({ ...p, operator: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=">">Greater than (&gt;)</SelectItem>
                      <SelectItem value="<">Less than (&lt;)</SelectItem>
                      <SelectItem value=">=">Greater or equal (≥)</SelectItem>
                      <SelectItem value="<=">Less or equal (≤)</SelectItem>
                      <SelectItem value="==">Equals (=)</SelectItem>
                      <SelectItem value="!=">Not equals (≠)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Value</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.threshold_value}
                    onChange={e => setFormData(p => ({ ...p, threshold_value: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <Label>Severity</Label>
                <Select value={formData.severity} onValueChange={v => setFormData(p => ({ ...p, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label>Send Email Notification</Label>
                <Switch
                  checked={formData.send_email}
                  onCheckedChange={v => setFormData(p => ({ ...p, send_email: v }))}
                />
              </div>

              <Button type="submit" className="w-full" disabled={createThreshold.isPending}>
                {createThreshold.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Threshold
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {thresholds.map(threshold => {
          const metricLabel = getMetricLabel(threshold);
          return (
            <Card key={threshold.id}>
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {metricLabel} {threshold.operator} {Number(threshold.threshold_value).toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={severityColor(threshold.severity)}>{threshold.severity}</Badge>
                      {threshold.send_email && <Badge variant="outline" className="text-xs">📧 Email</Badge>}
                      <Badge variant={threshold.is_active ? 'default' : 'secondary'} className="text-xs">
                        {threshold.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {(threshold as any).form_field_label && (
                        <Badge variant="outline" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" /> Form Field
                        </Badge>
                      )}
                      {(threshold as any).data_limit && (
                        <Badge variant="outline" className="text-xs">
                          Limit: {(threshold as any).data_limit}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => deleteThreshold.mutate(threshold.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {thresholds.length === 0 && !loading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                No thresholds configured. Add thresholds to trigger automatic alerts based on snapshot metrics or form field values.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
