import React, { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/contexts/ProjectContext';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { usePerformanceKPI } from '@/hooks/usePerformanceKPI';
import NoProjectSelected from '@/components/NoProjectSelected';
import { PerformanceProjectList } from '@/components/performance/PerformanceProjectList';
import { PerformanceActivityLog } from '@/components/performance/activity/PerformanceActivityLog';
import { PortfolioDashboard } from '@/components/performance/portfolio/PortfolioDashboard';
import { PerformanceDashboard } from '@/components/performance/dashboard/PerformanceDashboard';
import { AlertsPanel } from '@/components/performance/alerts/AlertsPanel';
import { ThresholdsConfig } from '@/components/performance/thresholds/ThresholdsConfig';
import { DataSourceConfig } from '@/components/performance/data-sources/DataSourceConfig';
import { AnalyticsPanel } from '@/components/performance/analytics/AnalyticsPanel';
import { ScenarioSimulator } from '@/components/performance/scenarios/ScenarioSimulator';
import { DataQualityPanel } from '@/components/performance/data-quality/DataQualityPanel';
import { TechnicalQuestionnaire } from '@/components/performance/questionnaire/TechnicalQuestionnaire';
import { ProjectLocationMap } from '@/components/performance/gis/ProjectLocationMap';
import { AlertTriangle, ArrowLeft, ClipboardCheck, Clock, Database, FileText, FlaskConical, Gauge, LineChart, MapPin, Settings2, ShieldCheck } from 'lucide-react';

interface SelectedPerfProject {
  id: string;
  name: string;
  form_id?: string | null;
  form_name?: string | null;
}

export default function ProjectPerformance() {
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPerfProject, setSelectedPerfProject] = useState<SelectedPerfProject | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');

  const perfData = usePerformanceMonitoring(selectedPerfProject?.id);
  const { submissions, mappings, loading: kpiLoading } = usePerformanceKPI(selectedPerfProject?.id);

  // Build record options from submissions
  const recordOptions = useMemo(() => {
    return submissions.map((sub: any) => {
      const data = sub.submission_data || {};
      const nameMapping = mappings.find(m =>
        m.formFieldLabel.toLowerCase().includes('project_name') ||
        m.formFieldLabel.toLowerCase().includes('project name')
      );
      let label = nameMapping ? String(data[nameMapping.formFieldId] || '') : '';
      if (!label) {
        label = Object.values(data).find((v: any) => typeof v === 'string' && v.length > 3 && v.length < 100) as string || '';
      }
      if (typeof label === 'object' && label !== null && 'value' in (label as any)) {
        label = (label as any).value;
      }
      const refId = sub.submission_ref_id || sub.id?.slice(0, 8) || '';
      return { id: sub.id, label: label ? `${refId} — ${label}` : refId };
    });
  }, [submissions, mappings]);

  // Get selected submission data
  const selectedSubmissionData = useMemo(() => {
    if (!selectedRecordId) return null;
    const sub = submissions.find((s: any) => s.id === selectedRecordId);
    return sub?.submission_data || null;
  }, [selectedRecordId, submissions]);

  // Reset record selection when changing perf project
  useEffect(() => {
    setSelectedRecordId('');
  }, [selectedPerfProject?.id]);

  if (!currentProject) {
    return <NoProjectSelected />;
  }

  if (!selectedPerfProject) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <PortfolioDashboard />
        <PerformanceProjectList onSelectProject={(p) => setSelectedPerfProject({ id: p.id, name: p.name, form_id: p.form_id, form_name: p.form_name })} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => { setSelectedPerfProject(null); setActiveTab('dashboard'); setSelectedRecordId(''); }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{selectedPerfProject.name}</h1>
          {selectedPerfProject.form_name && (
            <p className="text-muted-foreground text-sm mt-0.5">
              Analyzing: <span className="font-medium text-foreground">{selectedPerfProject.form_name}</span>
            </p>
          )}
        </div>
      </div>

      {/* Global Record Selector */}
      {submissions.length > 0 && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Record:</span>
              </div>
              <div className="flex-1 min-w-[280px]">
                <Select value={selectedRecordId} onValueChange={setSelectedRecordId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a record to analyze..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {recordOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="outline" className="text-xs">
                {selectedRecordId ? 'Single record' : `${submissions.length} records available`}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state when no record selected */}
      {!selectedRecordId && submissions.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-3">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Select a Record to Analyze</p>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a record from above to view KPIs, reports, quality scores, and run simulations.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs - only show when a record is selected or for config-only tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="dashboard" className="gap-1.5 text-xs">
            <Gauge className="h-3.5 w-3.5" />Performance Dashboard
          </TabsTrigger>
          <TabsTrigger value="data-sources" className="gap-1.5 text-xs">
            <Database className="h-3.5 w-3.5" />Data Sources
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5" />Alerts
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="gap-1.5 text-xs">
            <Settings2 className="h-3.5 w-3.5" />Thresholds
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 text-xs">
            <LineChart className="h-3.5 w-3.5" />Reports
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="gap-1.5 text-xs">
            <FlaskConical className="h-3.5 w-3.5" />What-If
          </TabsTrigger>
          <TabsTrigger value="data-quality" className="gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />Quality
          </TabsTrigger>
          <TabsTrigger value="gis" className="gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5" />GIS
          </TabsTrigger>
          <TabsTrigger value="questionnaire" className="gap-1.5 text-xs">
            <ClipboardCheck className="h-3.5 w-3.5" />Assessment
          </TabsTrigger>
          <TabsTrigger value="activity-log" className="gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" />Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <PerformanceDashboard
            perfProjectId={selectedPerfProject.id}
            alerts={perfData.alerts}
            predictions={perfData.predictions}
            thresholds={perfData.thresholds}
            loading={perfData.loading}
            onNavigateToThresholds={() => setActiveTab('thresholds')}
            selectedRecordId={selectedRecordId}
            onRecordChange={setSelectedRecordId}
          />
        </TabsContent>
        <TabsContent value="data-sources">
          <DataSourceConfig perfProjectId={selectedPerfProject.id} perfFormId={selectedPerfProject.form_id || undefined} />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsPanel
            alerts={perfData.alerts}
            loading={perfData.loading}
            updateAlertStatus={perfData.updateAlertStatus}
          />
        </TabsContent>
        <TabsContent value="thresholds">
          <ThresholdsConfig
            perfProjectId={selectedPerfProject.id}
            thresholds={perfData.thresholds}
            loading={perfData.loading}
            createThreshold={perfData.createThreshold}
            deleteThreshold={perfData.deleteThreshold}
          />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsPanel perfProjectId={selectedPerfProject?.id} selectedRecordId={selectedRecordId} />
        </TabsContent>
        <TabsContent value="scenarios">
          <ScenarioSimulator perfProjectId={selectedPerfProject.id} selectedRecordId={selectedRecordId} />
        </TabsContent>
        <TabsContent value="data-quality">
          <DataQualityPanel perfProjectId={selectedPerfProject.id} selectedRecordId={selectedRecordId} />
        </TabsContent>
        <TabsContent value="gis">
          <ProjectLocationMap perfProjectId={selectedPerfProject.id} />
        </TabsContent>
        <TabsContent value="questionnaire">
          <TechnicalQuestionnaire perfProjectId={selectedPerfProject.id} />
        </TabsContent>
        <TabsContent value="activity-log">
          <PerformanceActivityLog
            alerts={perfData.alerts}
            thresholds={perfData.thresholds}
            loading={perfData.loading}
            perfProjectId={selectedPerfProject.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
