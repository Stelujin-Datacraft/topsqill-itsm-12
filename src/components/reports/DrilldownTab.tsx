import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DrilldownConfig } from './DrilldownConfig';
import { ReportComponent } from '@/types/reports';
import { FormField } from '@/types/form';
import { TrendingDown } from 'lucide-react';

interface DrilldownTabProps {
  component: ReportComponent;
  formFields: FormField[];
  onUpdateComponent: (componentId: string, updates: Partial<ReportComponent>) => void;
}

export function DrilldownTab({ component, formFields, onUpdateComponent }: DrilldownTabProps) {
  const config = component.config as any;
  
  const handleDrilldownEnabledChange = (enabled: boolean) => {
    onUpdateComponent(component.id, {
      config: {
        ...config,
        drilldownEnabled: enabled,
        drilldownLevels: enabled ? (config.drilldownLevels || []) : []
      }
    });
  };

  const handleDrilldownLevelsChange = (levels: string[]) => {
    onUpdateComponent(component.id, {
      config: {
        ...config,
        drilldownLevels: levels
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Drilldown Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DrilldownConfig
            formFields={formFields}
            enabled={config.drilldownEnabled || false}
            onEnabledChange={handleDrilldownEnabledChange}
            drilldownLevels={config.drilldownLevels || []}
            onDrilldownLevelsChange={handleDrilldownLevelsChange}
            maxLevels={5}
          />
        </CardContent>
      </Card>
    </div>
  );
}