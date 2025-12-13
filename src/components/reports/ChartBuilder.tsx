
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useReports } from '@/hooks/useReports';
import { ChartConfig } from '@/types/reports';
import { ChartPreview } from './ChartPreview';
import { ChartConfigurationTabs } from './ChartConfigurationTabs';
import { Settings } from 'lucide-react';

interface ChartBuilderProps {
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  hideControls?: boolean;
}

export function ChartBuilder({ config, onConfigChange, hideControls = false }: ChartBuilderProps) {
  const [localConfig, setLocalConfig] = useState<ChartConfig>(config);
  const [availableForms, setAvailableForms] = useState<any[]>([]);
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const { getAvailableForms, getFormFields } = useReports();

  useEffect(() => {
    loadForms();
  }, []);

  // Sync local config with external config changes
  useEffect(() => {
    setLocalConfig(config);
    // Also load fields if formId changed from external config
    if (config.formId && config.formId !== localConfig.formId) {
      loadFormFields(config.formId);
    }
  }, [config]);

  // Load fields when formId changes in local config
  useEffect(() => {
    if (localConfig.formId) {
      loadFormFields(localConfig.formId);
    }
  }, [localConfig.formId]);

  const loadForms = async () => {
    try {
      const forms = await getAvailableForms();
      setAvailableForms(forms);
    } catch (error) {
      console.error('Error loading forms:', error);
    }
  };

  const loadFormFields = async (formId: string) => {
    try {
      const fields = await getFormFields(formId);
      setAvailableFields(fields);
    } catch (error) {
      console.error('Error loading form fields:', error);
    }
  };

  const handleConfigUpdate = (updates: Partial<ChartConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  // If hideControls is true, only show the chart preview
  if (hideControls) {
    return (
      <div className="h-full w-full">
        <ChartPreview config={localConfig} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ChartConfigurationTabs
        config={localConfig}
        onConfigChange={handleConfigUpdate}
        formFields={availableFields}
        forms={availableForms}
      />
    </div>
  );
}
