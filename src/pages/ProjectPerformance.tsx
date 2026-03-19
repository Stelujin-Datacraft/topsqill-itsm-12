import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProject } from '@/contexts/ProjectContext';
import NoProjectSelected from '@/components/NoProjectSelected';
import { PerformanceOverview } from '@/components/performance/overview/PerformanceOverview';
import { AlertsPanel } from '@/components/performance/alerts/AlertsPanel';
import { PredictionsPanel } from '@/components/performance/predictions/PredictionsPanel';
import { ThresholdsConfig } from '@/components/performance/thresholds/ThresholdsConfig';
import { DataSourceConfig } from '@/components/performance/data-sources/DataSourceConfig';
import { AlertTriangle, BarChart3, Brain, Database, Settings2 } from 'lucide-react';

export default function ProjectPerformance() {
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState('overview');

  if (!currentProject) {
    return <NoProjectSelected />;
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Project Performance</h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI-powered monitoring, anomaly detection, and predictive insights for {currentProject.name}
        </p>
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
          <PerformanceOverview />
        </TabsContent>
        <TabsContent value="data-sources">
          <DataSourceConfig />
        </TabsContent>
        <TabsContent value="snapshots">
          <SnapshotManager />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsPanel />
        </TabsContent>
        <TabsContent value="predictions">
          <PredictionsPanel />
        </TabsContent>
        <TabsContent value="thresholds">
          <ThresholdsConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
