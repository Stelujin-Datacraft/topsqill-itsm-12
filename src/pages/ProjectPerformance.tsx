import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useProject } from '@/contexts/ProjectContext';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { usePerformanceKPI } from '@/hooks/usePerformanceKPI';
import NoProjectSelected from '@/components/NoProjectSelected';
import { PerformanceProjectList } from '@/components/performance/PerformanceProjectList';
import { PerformanceActivityLog } from '@/components/performance/activity/PerformanceActivityLog';
import { PortfolioDashboard } from '@/components/performance/portfolio/PortfolioDashboard';
import { KPIDashboardTab } from '@/components/performance/kpi-dashboards/KPIDashboardTab';
import { AlertsPanel } from '@/components/performance/alerts/AlertsPanel';
import { ThresholdsConfig } from '@/components/performance/thresholds/ThresholdsConfig';
import { DataSourceConfig } from '@/components/performance/data-sources/DataSourceConfig';
import { AnalyticsPanel } from '@/components/performance/analytics/AnalyticsPanel';
import { ScenarioSimulator } from '@/components/performance/scenarios/ScenarioSimulator';
import { AlertTriangle, ArrowLeft, Clock, Database, FlaskConical, Gauge, LineChart, Network, Settings2 } from 'lucide-react';

interface SelectedPerfProject {
  id: string;
  name: string;
  form_id?: string | null;
  form_name?: string | null;
}

export default function ProjectPerformance() {
  const { currentProject } = useProject();
  const storageKey = currentProject?.id ? `perf-state-${currentProject.id}` : null;

  // Restore persisted state
  const getPersistedState = () => {
    if (!storageKey) return { tab: 'dashboard', project: null, record: '' };
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { tab: 'dashboard', project: null, record: '' };
  };

  const persisted = getPersistedState();
  const [activeTab, setActiveTab] = useState<string>(persisted.tab || 'dashboard');
  const [selectedPerfProject, setSelectedPerfProject] = useState<SelectedPerfProject | null>(persisted.project || null);
  const [selectedRecordId, setSelectedRecordId] = useState<string>(persisted.record || '');
  const [stateValidated, setStateValidated] = useState(false);

  // Validate persisted state: check if the data source still exists
  useEffect(() => {
    const validatePersistedState = async () => {
      if (!selectedPerfProject?.id) {
        setStateValidated(true);
        return;
      }

      // Check if the perf project's data source still exists
      const { data: dataSources } = await (supabase
        .from('performance_data_sources')
        .select('id') as any)
        .eq('perf_project_id', selectedPerfProject.id)
        .limit(1);

      if (!dataSources || dataSources.length === 0) {
        // Data source was deleted — reset to fresh state
        setSelectedRecordId('');
        setActiveTab('data-sources');
        if (storageKey) localStorage.removeItem(storageKey);
      }
      setStateValidated(true);
    };

    validatePersistedState();
  }, []); // Only on mount

  // Persist state changes (only after validation)
  useEffect(() => {
    if (!storageKey || !stateValidated) return;
    localStorage.setItem(storageKey, JSON.stringify({
      tab: activeTab,
      project: selectedPerfProject,
      record: selectedRecordId,
    }));
  }, [storageKey, activeTab, selectedPerfProject, selectedRecordId, stateValidated]);

  const perfData = usePerformanceMonitoring(selectedPerfProject?.id);

  // Only clear record when perf project actually changes (not on mount from persisted)
  const prevPerfProjectRef = React.useRef(selectedPerfProject?.id);
  useEffect(() => {
    if (prevPerfProjectRef.current && prevPerfProjectRef.current !== selectedPerfProject?.id) {
      setSelectedRecordId('');
    }
    prevPerfProjectRef.current = selectedPerfProject?.id;
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="data-sources" className="gap-1.5 text-xs">
            <Database className="h-3.5 w-3.5" />Data Sources
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5 text-xs">
            <Gauge className="h-3.5 w-3.5" />Performance Dashboard
          </TabsTrigger>
          <TabsTrigger value="hierarchy-kpi" className="gap-1.5 text-xs">
            <Network className="h-3.5 w-3.5" />Hierarchy KPI
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
        <TabsContent value="hierarchy-kpi">
          <KPIDashboardTab perfProjectId={selectedPerfProject.id} />
        </TabsContent>
        <TabsContent value="data-sources">
          <DataSourceConfig perfProjectId={selectedPerfProject.id} perfFormId={selectedPerfProject.form_id || undefined} />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsPanel alerts={perfData.alerts} loading={perfData.loading} updateAlertStatus={perfData.updateAlertStatus} />
        </TabsContent>
        <TabsContent value="thresholds">
          <ThresholdsConfig perfProjectId={selectedPerfProject.id} thresholds={perfData.thresholds} loading={perfData.loading} createThreshold={perfData.createThreshold} deleteThreshold={perfData.deleteThreshold} />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsPanel perfProjectId={selectedPerfProject?.id} selectedRecordId={selectedRecordId} />
        </TabsContent>
        <TabsContent value="scenarios">
          <ScenarioSimulator perfProjectId={selectedPerfProject.id} selectedRecordId={selectedRecordId} />
        </TabsContent>
        <TabsContent value="activity-log">
          <PerformanceActivityLog alerts={perfData.alerts} thresholds={perfData.thresholds} loading={perfData.loading} perfProjectId={selectedPerfProject.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
