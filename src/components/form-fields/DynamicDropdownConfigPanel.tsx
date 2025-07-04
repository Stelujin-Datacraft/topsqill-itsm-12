
import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@/contexts/FormContext';

interface DynamicDropdownConfigPanelProps {
  field: FormField;
  onConfigChange: (config: any) => void;
}

export function DynamicDropdownConfigPanel({ field, onConfigChange }: DynamicDropdownConfigPanelProps) {
  const { forms } = useForm();
  
  // Local state - sync when field.id changes
  const [localState, setLocalState] = useState({
    dataSource: field.customConfig?.dataSource || 'form' as 'form' | 'api',
    sourceFormId: field.customConfig?.sourceFormId || '',
    displayField: field.customConfig?.displayField || '',
    valueField: field.customConfig?.valueField || '',
    apiEndpoint: field.customConfig?.apiEndpoint || '',
    apiHeaders: field.customConfig?.apiHeaders ? JSON.stringify(field.customConfig.apiHeaders, null, 2) : ''
  });

  // Update local state when field changes
  useEffect(() => {
    const newState = {
      dataSource: field.customConfig?.dataSource || 'form' as 'form' | 'api',
      sourceFormId: field.customConfig?.sourceFormId || '',
      displayField: field.customConfig?.displayField || '',
      valueField: field.customConfig?.valueField || '',
      apiEndpoint: field.customConfig?.apiEndpoint || '',
      apiHeaders: field.customConfig?.apiHeaders ? JSON.stringify(field.customConfig.apiHeaders, null, 2) : ''
    };
    setLocalState(newState);
  }, [field.id]);

  // Update parent immediately when local state changes
  useEffect(() => {
    onConfigChange({
      dataSource: localState.dataSource,
      sourceFormId: localState.sourceFormId,
      displayField: localState.displayField,
      valueField: localState.valueField,
      apiEndpoint: localState.apiEndpoint,
      apiHeaders: localState.apiHeaders ? (() => {
        try {
          return JSON.parse(localState.apiHeaders);
        } catch {
          return undefined;
        }
      })() : undefined
    });
  }, [localState, onConfigChange]);

  const updateLocalState = (key: string, value: any) => {
    setLocalState(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleDataSourceChange = (value: string) => {
    updateLocalState('dataSource', value as 'form' | 'api');
  };

  const availableForms = forms.filter(form => form.status === 'active');
  const selectedForm = availableForms.find(form => form.id === localState.sourceFormId);

  return (
    <div className="space-y-4">
      {/* Data Source Type */}
      <div>
        <Label>Data Source</Label>
        <Select value={localState.dataSource} onValueChange={handleDataSourceChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="form">Form Records</SelectItem>
            <SelectItem value="api">API Endpoint</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Form-based Configuration */}
      {localState.dataSource === 'form' && (
        <>
          <div>
            <Label>Source Form</Label>
            <Select value={localState.sourceFormId || undefined} onValueChange={(value) => updateLocalState('sourceFormId', value || '')}>
              <SelectTrigger>
                <SelectValue placeholder="Select a form..." />
              </SelectTrigger>
              <SelectContent>
                {availableForms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedForm && (
            <>
              <div>
                <Label>Display Field</Label>
                <Select value={localState.displayField || undefined} onValueChange={(value) => updateLocalState('displayField', value || '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select field to display..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedForm.fields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Value Field</Label>
                <Select value={localState.valueField || undefined} onValueChange={(value) => updateLocalState('valueField', value || '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select field for value..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedForm.fields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </>
      )}

      {/* API-based Configuration */}
      {localState.dataSource === 'api' && (
        <>
          <div>
            <Label>API Endpoint</Label>
            <Input
              value={localState.apiEndpoint}
              onChange={(e) => updateLocalState('apiEndpoint', e.target.value)}
              placeholder="https://api.example.com/data"
            />
          </div>

          <div>
            <Label>API Headers (JSON)</Label>
            <Textarea
              value={localState.apiHeaders}
              onChange={(e) => updateLocalState('apiHeaders', e.target.value)}
              placeholder='{"Authorization": "Bearer token"}'
              rows={3}
            />
          </div>
        </>
      )}
    </div>
  );
}
