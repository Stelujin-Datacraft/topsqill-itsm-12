import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePerformanceMonitoring, AIAnalysis } from '@/hooks/usePerformanceMonitoring';
import { Brain, TrendingUp, TrendingDown, DollarSign, Users, CheckCircle2, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useState } from 'react';

export function PerformanceOverview() {
  const { snapshots, alerts, predictions, loading, runAnalysis } = usePerformanceMonitoring();
  const [aiResult, setAiResult] = useState<AIAnalysis | null>(null);

  const latestSnapshot = snapshots[0];
  const activeAlerts = alerts.filter(a => a.status === 'active');

  const handleRunAnalysis = async () => {
    const result = await runAnalysis.mutateAsync();
    setAiResult(result);
  };

  const healthColor = (status?: string) => {
    switch (status) {
      case 'green': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'yellow': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'orange': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'red': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const budgetChartData = snapshots.slice().reverse().map(s => ({
    date: new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    planned: Number(s.planned_budget),
    actual: Number(s.actual_budget),
  }));

  const progressChartData = snapshots.slice().reverse().map(s => ({
    date: new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    completion: Number(s.completion_pct),
    resources: Number(s.resource_utilization_pct),
  }));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* AI Analysis Button */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold text-foreground">AI Performance Analysis</p>
              <p className="text-sm text-muted-foreground">
                Run anomaly detection, trend analysis, and predictive insights on snapshots and connected form data
              </p>
            </div>
          </div>
          <Button onClick={handleRunAnalysis} disabled={runAnalysis.isPending}>
            {runAnalysis.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : 'Run AI Analysis'}
          </Button>
        </CardContent>
      </Card>

      {/* AI Results */}
      {aiResult && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Analysis Results
            </CardTitle>
            <CardDescription>{aiResult.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge className={healthColor(aiResult.health_status)}>
                Health: {aiResult.health_status?.toUpperCase()}
              </Badge>
              <Badge variant="outline">Risk Score: {aiResult.risk_score}/100</Badge>
            </div>

            {aiResult.recommendations?.length > 0 && (
              <div>
                <p className="font-medium text-sm mb-2">Recommendations:</p>
                <div className="space-y-2">
                  {aiResult.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                      <Badge variant={rec.priority === 'critical' ? 'destructive' : 'secondary'} className="text-xs mt-0.5">
                        {rec.priority}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">{rec.title}</p>
                        <p className="text-xs text-muted-foreground">{rec.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Budget Variance</p>
                <p className="text-2xl font-bold text-foreground">
                  {latestSnapshot ? `$${Number(latestSnapshot.budget_variance).toLocaleString()}` : '—'}
                </p>
              </div>
              <DollarSign className={`h-8 w-8 ${latestSnapshot && Number(latestSnapshot.budget_variance) > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
            </div>
            {latestSnapshot && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                {Number(latestSnapshot.budget_variance) > 0 ? <TrendingUp className="h-3 w-3 text-red-500" /> : <TrendingDown className="h-3 w-3 text-emerald-500" />}
                {Number(latestSnapshot.budget_variance) > 0 ? 'Over budget' : 'Under budget'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completion</p>
                <p className="text-2xl font-bold text-foreground">
                  {latestSnapshot ? `${Number(latestSnapshot.completion_pct).toFixed(1)}%` : '—'}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            {latestSnapshot && (
              <p className="text-xs text-muted-foreground mt-2">
                {latestSnapshot.completed_tasks}/{latestSnapshot.total_tasks} tasks done
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resources</p>
                <p className="text-2xl font-bold text-foreground">
                  {latestSnapshot ? `${Number(latestSnapshot.resource_utilization_pct).toFixed(0)}%` : '—'}
                </p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
            {latestSnapshot && (
              <p className="text-xs text-muted-foreground mt-2">
                {latestSnapshot.actual_resources}/{latestSnapshot.planned_resources} allocated
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold text-foreground">{activeAlerts.length}</p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${activeAlerts.length > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </div>
            {latestSnapshot && (
              <Badge className={`mt-2 ${healthColor(latestSnapshot.health_status)}`}>
                {latestSnapshot.health_status?.toUpperCase() || 'N/A'}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {budgetChartData.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Budget Trend</CardTitle>
              <CardDescription>Planned vs Actual spend over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={budgetChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="planned" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} name="Planned" />
                  <Area type="monotone" dataKey="actual" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.1} name="Actual" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress & Utilization</CardTitle>
              <CardDescription>Task completion and resource usage trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={progressChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="completion" stroke="hsl(var(--primary))" name="Completion %" strokeWidth={2} />
                  <Line type="monotone" dataKey="resources" stroke="hsl(var(--accent-foreground))" name="Utilization %" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {snapshots.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-foreground">No performance data yet</p>
            <p className="text-sm text-muted-foreground mt-1">Go to the Snapshots tab to record your first project performance snapshot.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
