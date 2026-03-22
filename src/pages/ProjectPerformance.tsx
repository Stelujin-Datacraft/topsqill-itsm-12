import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useProject } from '@/contexts/ProjectContext';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import NoProjectSelected from '@/components/NoProjectSelected';
import { PerformanceProjectList } from '@/components/performance/PerformanceProjectList';
import { PerformanceActivityLog } from '@/components/performance/activity/PerformanceActivityLog';
import { PortfolioDashboard } from '@/components/performance/portfolio/PortfolioDashboard';
import { PerformanceOverview } from '@/components/performance/overview/PerformanceOverview';
import { AlertsPanel } from '@/components/performance/alerts/AlertsPanel';
import { ThresholdsConfig } from '@/components/performance/thresholds/ThresholdsConfig';
import { DataSourceConfig } from '@/components/performance/data-sources/DataSourceConfig';
import { AnalyticsPanel } from '@/components/performance/analytics/AnalyticsPanel';
import { ScenarioSimulator } from '@/components/performance/scenarios/ScenarioSimulator';
import { DataQualityPanel } from '@/components/performance/data-quality/DataQualityPanel';
import { TechnicalQuestionnaire } from '@/components/performance/questionnaire/TechnicalQuestionnaire';
import { ProjectLocationMap } from '@/components/performance/gis/ProjectLocationMap';
import { KPIDashboardTab } from '@/components/performance/kpi-dashboards/KPIDashboardTab';
import { AlertTriangle, ArrowLeft, BarChart3, ClipboardCheck, Clock, Database, FlaskConical, Gauge, LineChart, MapPin, Settings2, ShieldCheck } from 'lucide-react';

interface SelectedPerfProject {
  id: string;
  name: string;
  form_id?: string | null;
  form_name?: string | null;
}

export default function ProjectPerformance() {
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPerfProject, setSelectedPerfProject] = useState<SelectedPerfProject | null>(null);

  const perfData = usePerformanceMonitoring(selectedPerfProject?.id);

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
        <Button variant="ghost" size="icon" onClick={() => { setSelectedPerfProject(null); setActiveTab('overview'); }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
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
          <TabsTrigger value="kpi-dashboards" className="gap-1.5 text-xs">
            <Gauge className="h-3.5 w-3.5" />KPI Dashboards
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" />Overview
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

        <TabsContent value="overview">
          <PerformanceOverview
            alerts={perfData.alerts}
            predictions={perfData.predictions}
            thresholds={perfData.thresholds}
            loading={perfData.loading}
            runAnalysis={perfData.runAnalysis}
            onNavigateToThresholds={() => setActiveTab('thresholds')}
            perfProjectId={selectedPerfProject.id}
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
          <AnalyticsPanel perfProjectId={selectedPerfProject.id} />
        </TabsContent>
        <TabsContent value="scenarios">
          <ScenarioSimulator perfProjectId={selectedPerfProject.id} />
        </TabsContent>
        <TabsContent value="data-quality">
          <DataQualityPanel perfProjectId={selectedPerfProject.id} />
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