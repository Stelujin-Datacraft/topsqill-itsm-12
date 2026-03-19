import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, Settings2, FileText } from 'lucide-react';

interface FormFieldOption {
  id: string;
  label: string;
  field_type: string;
}

interface Props {
  perfProjectId?: string;
  perfFormId?: string;
  perfFormName?: string;
}

export function ThresholdsConfig({ perfProjectId, perfFormId, perfFormName }: Props) {
  const { thresholds, loading, createThreshold, deleteThreshold } = usePerformanceMonitoring(perfProjectId);
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    operator: '>',
    threshold_value: 0,
    severity: 'medium',
    send_email: false,
    form_field_id: '',
    form_field_label: '',
    data_limit: 100,
  });

  // Fetch numeric fields for the performance project's form (auto-selected)
  const { data: formFields = [] } = useQuery({
    queryKey: ['form-fields-for-thresholds', perfFormId],
    queryFn: async () => {
      if (!perfFormId) return [];
      const { data, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', perfFormId)
        .in('field_type', ['number', 'slider', 'calculated', 'currency'])
        .order('field_order');
      if (error) throw error;
      return data as FormFieldOption[];
    },
    enabled: !!perfFormId,
  });

  // Get data source ID for this perf project (to properly link threshold)
  const { data: dataSourceId } = useQuery({
    queryKey: ['perf-data-source-id', perfProjectId],
    queryFn: async () => {
      if (!perfProjectId || !projectId) return null;
      const { data } = await supabase
        .from('performance_data_sources')
        .select('id')
        .eq('performance_project_id', perfProjectId)
        .limit(1)
        .maybeSingle();
      return data?.id || null;
    },
    enabled: !!perfProjectId && !!projectId,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.form_field_id) return;

    await createThreshold.mutateAsync({
      metric_name: `${perfFormName || 'Form'} → ${formData.form_field_label}`,
      operator: formData.operator,
      threshold_value: formData.threshold_value,
      severity: formData.severity,
      send_email: formData.send_email,
      data_source_id: dataSourceId || undefined,
      form_field_id: formData.form_field_id,
      form_field_label: formData.form_field_label,
      data_limit: formData.data_limit,
    });
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      operator: '>', threshold_value: 0, severity: 'medium',
      send_email: false, form_field_id: '', form_field_label: '', data_limit: 100,
    });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Alert Thresholds</h2>
          <p className="text-sm text-muted-foreground">
            Configure automatic alert triggers for <span className="font-medium text-foreground">{perfFormName || 'form'}</span> fields
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button disabled={formFields.length === 0}>
              <Plus className="mr-2 h-4 w-4" />Add Threshold
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Alert Threshold</DialogTitle>
              <DialogDescription>
                Set threshold for a numeric field in "{perfFormName}"
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Field Selection - auto-scoped to perf project form */}
              <div>
                <Label>Numeric Field</Label>
                {formFields.length > 0 ? (
                  <Select
                    value={formData.form_field_id}
                    onValueChange={v => {
                      const field = formFields.find(f => f.id === v);
                      setFormData(p => ({
                        ...p,
                        form_field_id: v,
                        form_field_label: field?.label || '',
                      }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select field..." /></SelectTrigger>
                    <SelectContent>
                      {formFields.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.label} <span className="text-muted-foreground ml-1">({f.field_type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    No numeric fields found in this form.
                  </p>
                )}
              </div>

              {/* Operator & Value */}
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

              {/* Data Limit */}
              <div>
                <Label>Data Limit</Label>
                <Input
                  type="number"
                  min={10}
                  max={1000}
                  value={formData.data_limit}
                  onChange={e => setFormData(p => ({ ...p, data_limit: parseInt(e.target.value) || 100 }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Max submissions to evaluate (10-1000)</p>
              </div>

              {/* Severity */}
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

              {/* Email */}
              <div className="flex items-center justify-between">
                <Label>Send Email Notification</Label>
                <Switch
                  checked={formData.send_email}
                  onCheckedChange={v => setFormData(p => ({ ...p, send_email: v }))}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createThreshold.isPending || !formData.form_field_id}
              >
                {createThreshold.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Threshold
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Thresholds List */}
      <div className="space-y-3">
        {thresholds.map(threshold => (
          <Card key={threshold.id}>
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {threshold.form_field_label || threshold.metric_name} {threshold.operator} {Number(threshold.threshold_value).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge className={severityColor(threshold.severity)}>{threshold.severity}</Badge>
                    {threshold.send_email && <Badge variant="outline" className="text-xs">📧 Email</Badge>}
                    <Badge variant={threshold.is_active ? 'default' : 'secondary'} className="text-xs">
                      {threshold.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {threshold.data_limit && (
                      <Badge variant="outline" className="text-xs">
                        Limit: {threshold.data_limit}
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
        ))}
        {thresholds.length === 0 && !loading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                No thresholds configured. Add thresholds to trigger automatic alerts when field values exceed limits.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
