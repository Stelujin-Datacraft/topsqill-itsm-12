import React from 'react';
import { DrilldownConfig } from './DrilldownConfig';
import { ReportComponent } from '@/types/reports';
import { FormField } from '@/types/form';

interface DrilldownTabProps {
  component: ReportComponent;
  formFields: FormField[];
  onUpdateComponent: (componentId: string, updates: Partial<ReportComponent>) => void;
}

export function DrilldownTab({ component, formFields, onUpdateComponent }: DrilldownTabProps) {
  const config = component.config as any;
  
  // Check if cross-reference mode is enabled
  const isCrossRefEnabled = config.crossRefConfig?.enabled;
  
  const handleDrilldownEnabledChange = (enabled: boolean) => {
    onUpdateComponent(component.id, {
      config: {
        ...config,
        drilldownConfig: {
          ...config.drilldownConfig,
          enabled: enabled,
          drilldownLevels: enabled ? (config.drilldownConfig?.drilldownLevels || []) : []
        }
      }
    });
  };

  const handleDrilldownLevelsChange = (levels: string[]) => {
    onUpdateComponent(component.id, {
      config: {
        ...config,
        drilldownConfig: {
          ...config.drilldownConfig,
          enabled: config.drilldownConfig?.enabled || false,
          drilldownLevels: levels
        }
      }
    });
  };

  // When cross-reference is enabled, show message to use cross-ref drilldown
  if (isCrossRefEnabled) {
    return (
      <div className="p-4 text-center border border-dashed rounded-lg bg-muted/50">
        <div className="text-muted-foreground mb-2">
          Cross-Reference mode is enabled.
        </div>
        <div className="text-sm text-muted-foreground">
          Please configure drilldown in the <span className="font-medium">Data → Cross-Reference</span> section instead.
        </div>
      </div>
    );
  }

  return (
    <DrilldownConfig
      formFields={formFields}
      enabled={config.drilldownConfig?.enabled || false}
      onEnabledChange={handleDrilldownEnabledChange}
      drilldownLevels={config.drilldownConfig?.drilldownLevels || []}
      onDrilldownLevelsChange={handleDrilldownLevelsChange}
    />
  );
}