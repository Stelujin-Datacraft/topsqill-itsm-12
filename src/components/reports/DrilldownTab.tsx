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

  return (
    <DrilldownConfig
      formFields={formFields}
      enabled={config.drilldownConfig?.enabled || false}
      onEnabledChange={handleDrilldownEnabledChange}
      drilldownLevels={config.drilldownConfig?.drilldownLevels || []}
      onDrilldownLevelsChange={handleDrilldownLevelsChange}
      maxLevels={5}
    />
  );
}