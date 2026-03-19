import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { Plus, Calendar, DollarSign, Users, CheckSquare, Milestone, Loader2, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export function SnapshotManager() {
  const { snapshots, loading, createSnapshot } = usePerformanceMonitoring();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    snapshot_date: new Date().toISOString().split('T')[0],
    planned_budget: 0,
    actual_budget: 0,
    planned_start_date: '',
    planned_end_date: '',
    actual_start_date: '',
    projected_end_date: '',
    schedule_variance_days: 0,
    planned_resources: 0,
    actual_resources: 0,
    resource_utilization_pct: 0,
    total_tasks: 0,
    completed_tasks: 0,
    in_progress_tasks: 0,
    blocked_tasks: 0,
    total_milestones: 0,
    completed_milestones: 0,
    overdue_milestones: 0,
    risk_score: 0,
    health_status: 'green' as const,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSnapshot.mutateAsync(formData);
    setOpen(false);
    setFormData({
      snapshot_date: new Date().toISOString().split('T')[0],
      planned_budget: 0, actual_budget: 0,
      planned_start_date: '', planned_end_date: '', actual_start_date: '', projected_end_date: '',
      schedule_variance_days: 0, planned_resources: 0, actual_resources: 0, resource_utilization_pct: 0,
      total_tasks: 0, completed_tasks: 0, in_progress_tasks: 0, blocked_tasks: 0,
      total_milestones: 0, completed_milestones: 0, overdue_milestones: 0,
      risk_score: 0, health_status: 'green', notes: '',
    });
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const healthColor = (status: string) => {
    switch (status) {
      case 'green': return 'bg-emerald-500/10 text-emerald-600';
      case 'yellow': return 'bg-yellow-500/10 text-yellow-600';
      case 'orange': return 'bg-orange-500/10 text-orange-600';
      case 'red': return 'bg-red-500/10 text-red-600';
      default: return '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Performance Snapshots</h2>
          <p className="text-sm text-muted-foreground">Record periodic project data for trend analysis</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New Snapshot</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Performance Snapshot</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label>Snapshot Date</Label>
                <Input type="date" value={formData.snapshot_date} onChange={e => updateField('snapshot_date', e.target.value)} />
              </div>

              {/* Budget Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <DollarSign className="h-4 w-4 text-primary" /> Budget
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Planned Budget</Label><Input type="number" step="0.01" value={formData.planned_budget} onChange={e => updateField('planned_budget', parseFloat(e.target.value) || 0)} /></div>
                  <div><Label className="text-xs">Actual Budget</Label><Input type="number" step="0.01" value={formData.actual_budget} onChange={e => updateField('actual_budget', parseFloat(e.target.value) || 0)} /></div>
                </div>
              </div>

              {/* Timeline Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Calendar className="h-4 w-4 text-primary" /> Timeline
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Planned Start</Label><Input type="date" value={formData.planned_start_date} onChange={e => updateField('planned_start_date', e.target.value)} /></div>
                  <div><Label className="text-xs">Planned End</Label><Input type="date" value={formData.planned_end_date} onChange={e => updateField('planned_end_date', e.target.value)} /></div>
                  <div><Label className="text-xs">Actual Start</Label><Input type="date" value={formData.actual_start_date} onChange={e => updateField('actual_start_date', e.target.value)} /></div>
                  <div><Label className="text-xs">Projected End</Label><Input type="date" value={formData.projected_end_date} onChange={e => updateField('projected_end_date', e.target.value)} /></div>
                </div>
                <div><Label className="text-xs">Schedule Variance (days, positive = delayed)</Label><Input type="number" value={formData.schedule_variance_days} onChange={e => updateField('schedule_variance_days', parseInt(e.target.value) || 0)} /></div>
              </div>

              {/* Resources Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Users className="h-4 w-4 text-primary" /> Resources
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Planned</Label><Input type="number" value={formData.planned_resources} onChange={e => updateField('planned_resources', parseInt(e.target.value) || 0)} /></div>
                  <div><Label className="text-xs">Actual</Label><Input type="number" value={formData.actual_resources} onChange={e => updateField('actual_resources', parseInt(e.target.value) || 0)} /></div>
                  <div><Label className="text-xs">Utilization %</Label><Input type="number" min={0} max={100} value={formData.resource_utilization_pct} onChange={e => updateField('resource_utilization_pct', parseFloat(e.target.value) || 0)} /></div>
                </div>
              </div>

              {/* Tasks Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CheckSquare className="h-4 w-4 text-primary" /> Tasks
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div><Label className="text-xs">Total</Label><Input type="number" value={formData.total_tasks} onChange={e => updateField('total_tasks', parseInt(e.target.value) || 0)} /></div>
                  <div><Label className="text-xs">Completed</Label><Input type="number" value={formData.completed_tasks} onChange={e => updateField('completed_tasks', parseInt(e.target.value) || 0)} /></div>
                  <div><Label className="text-xs">In Progress</Label><Input type="number" value={formData.in_progress_tasks} onChange={e => updateField('in_progress_tasks', parseInt(e.target.value) || 0)} /></div>
                  <div><Label className="text-xs">Blocked</Label><Input type="number" value={formData.blocked_tasks} onChange={e => updateField('blocked_tasks', parseInt(e.target.value) || 0)} /></div>
                </div>
              </div>

              {/* Milestones Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Milestone className="h-4 w-4 text-primary" /> Milestones
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Total</Label><Input type="number" value={formData.total_milestones} onChange={e => updateField('total_milestones', parseInt(e.target.value) || 0)} /></div>
                  <div><Label className="text-xs">Completed</Label><Input type="number" value={formData.completed_milestones} onChange={e => updateField('completed_milestones', parseInt(e.target.value) || 0)} /></div>
                  <div><Label className="text-xs">Overdue</Label><Input type="number" value={formData.overdue_milestones} onChange={e => updateField('overdue_milestones', parseInt(e.target.value) || 0)} /></div>
                </div>
              </div>

              {/* Risk & Health */}
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Risk Score (0-100)</Label><Input type="number" min={0} max={100} value={formData.risk_score} onChange={e => updateField('risk_score', parseFloat(e.target.value) || 0)} /></div>
                <div>
                  <Label className="text-xs">Health Status</Label>
                  <Select value={formData.health_status} onValueChange={v => updateField('health_status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="green">🟢 Green</SelectItem>
                      <SelectItem value="yellow">🟡 Yellow</SelectItem>
                      <SelectItem value="orange">🟠 Orange</SelectItem>
                      <SelectItem value="red">🔴 Red</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div><Label className="text-xs">Notes</Label><Textarea value={formData.notes} onChange={e => updateField('notes', e.target.value)} placeholder="Any additional context..." /></div>

              <Button type="submit" className="w-full" disabled={createSnapshot.isPending}>
                {createSnapshot.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Snapshot'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Snapshots List */}
      <div className="space-y-3">
        {snapshots.map(snapshot => (
          <Card key={snapshot.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge className={healthColor(snapshot.health_status)}>
                    {snapshot.health_status?.toUpperCase()}
                  </Badge>
                  <div>
                    <p className="font-medium text-sm text-foreground">
                      {format(new Date(snapshot.snapshot_date), 'MMM dd, yyyy')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Budget: ${Number(snapshot.planned_budget).toLocaleString()} planned / ${Number(snapshot.actual_budget).toLocaleString()} actual
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Completion</p>
                    <p className="font-semibold text-foreground">{Number(snapshot.completion_pct).toFixed(0)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Resources</p>
                    <p className="font-semibold text-foreground">{snapshot.actual_resources}/{snapshot.planned_resources}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Risk</p>
                    <p className="font-semibold text-foreground">{Number(snapshot.risk_score).toFixed(0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Blocked</p>
                    <p className="font-semibold text-foreground">{snapshot.blocked_tasks}</p>
                  </div>
                </div>
              </div>
              {snapshot.notes && <p className="text-xs text-muted-foreground mt-2 border-t pt-2 border-border">{snapshot.notes}</p>}
            </CardContent>
          </Card>
        ))}
        {snapshots.length === 0 && !loading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">No snapshots recorded yet. Click "New Snapshot" to start tracking.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
