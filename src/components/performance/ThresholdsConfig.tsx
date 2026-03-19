import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { Plus, Trash2, Loader2, Settings2 } from 'lucide-react';

const METRIC_OPTIONS = [
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
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    metric_name: 'budget_variance',
    operator: '>',
    threshold_value: 0,
    severity: 'medium',
    send_email: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createThreshold.mutateAsync(formData);
    setOpen(false);
    setFormData({ metric_name: 'budget_variance', operator: '>', threshold_value: 0, severity: 'medium', send_email: false });
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
          <p className="text-sm text-muted-foreground">Configure automatic alert triggers for performance metrics</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Threshold</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Alert Threshold</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Metric</Label>
                <Select value={formData.metric_name} onValueChange={v => setFormData(p => ({ ...p, metric_name: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METRIC_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
                  <Input type="number" step="0.01" value={formData.threshold_value} onChange={e => setFormData(p => ({ ...p, threshold_value: parseFloat(e.target.value) || 0 }))} />
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
                <Switch checked={formData.send_email} onCheckedChange={v => setFormData(p => ({ ...p, send_email: v }))} />
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
          const metricLabel = METRIC_OPTIONS.find(m => m.value === threshold.metric_name)?.label || threshold.metric_name;
          return (
            <Card key={threshold.id}>
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {metricLabel} {threshold.operator} {Number(threshold.threshold_value).toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={severityColor(threshold.severity)}>{threshold.severity}</Badge>
                      {threshold.send_email && <Badge variant="outline" className="text-xs">📧 Email</Badge>}
                      <Badge variant={threshold.is_active ? 'default' : 'secondary'} className="text-xs">
                        {threshold.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteThreshold.mutate(threshold.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {thresholds.length === 0 && !loading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">No thresholds configured. Add thresholds to trigger automatic alerts.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
