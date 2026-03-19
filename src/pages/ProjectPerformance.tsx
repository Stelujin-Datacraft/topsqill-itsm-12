import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useProject } from '@/contexts/ProjectContext';
import NoProjectSelected from '@/components/NoProjectSelected';
import { PerformanceProjectList } from '@/components/performance/PerformanceProjectList';
import { PerformanceOverview } from '@/components/performance/overview/PerformanceOverview';
import { AlertsPanel } from '@/components/performance/alerts/AlertsPanel';
import { PredictionsPanel } from '@/components/performance/predictions/PredictionsPanel';
import { ThresholdsConfig } from '@/components/performance/thresholds/ThresholdsConfig';
import { DataSourceConfig } from '@/components/performance/data-sources/DataSourceConfig';
import { AnalyticsPanel } from '@/components/performance/analytics/AnalyticsPanel';
import { AlertTriangle, ArrowLeft, BarChart3, Brain, Database, LineChart, Settings2 } from 'lucide-react';

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

  if (!currentProject) {
    return <NoProjectSelected />;
  }

  // If no performance project selected, show list
  if (!selectedPerfProject) {
    return (
      <div className="flex-1 overflow-auto p-6">
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
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="data-sources" className="gap-2">
            <Database className="h-4 w-4" />
            Data Sources
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="predictions" className="gap-2">
            <Brain className="h-4 w-4" />
            AI Predictions
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Thresholds
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <PerformanceOverview perfProjectId={selectedPerfProject.id} />
        </TabsContent>
        <TabsContent value="data-sources">
          <DataSourceConfig perfProjectId={selectedPerfProject.id} perfFormId={selectedPerfProject.form_id || undefined} />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsPanel perfProjectId={selectedPerfProject.id} />
        </TabsContent>
        <TabsContent value="predictions">
          <PredictionsPanel perfProjectId={selectedPerfProject.id} />
        </TabsContent>
        <TabsContent value="thresholds">
          <ThresholdsConfig perfProjectId={selectedPerfProject.id} perfFormId={selectedPerfProject.form_id || undefined} perfFormName={selectedPerfProject.form_name || undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
