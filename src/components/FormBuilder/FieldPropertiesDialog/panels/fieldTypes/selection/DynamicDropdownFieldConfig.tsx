import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFormsData } from '@/hooks/useFormsData';
import { useCurrentFormFields } from '@/hooks/useCurrentFormFields';

interface DynamicDropdownFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors?: Record<string, string>;
}

export function DynamicDropdownFieldConfig({ config, onUpdate, errors }: DynamicDropdownFieldConfigProps) {
  const customConfig = config.customConfig || {};
  const { forms } = useFormsData();
  const { formFieldOptions } = useCurrentFormFields();

  const handleConfigChange = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Dynamic Dropdown Configuration</h3>
        
        <div className="space-y-2">
          <Label htmlFor="dataSource">Data Source</Label>
          <Select
            value={customConfig.dataSource || 'form'}
            onValueChange={(value) => handleConfigChange('dataSource', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select data source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="form">Form Submissions</SelectItem>
              <SelectItem value="api">External API</SelectItem>
              <SelectItem value="field">Dependent Field</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {customConfig.dataSource === 'form' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="sourceForm">Source Form</Label>
              <Select
                value={customConfig.sourceFormId || ''}
                onValueChange={(value) => handleConfigChange('sourceFormId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source form" />
                </SelectTrigger>
                <SelectContent>
                  {forms.map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      {form.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayField">Display Field</Label>
              <Select
                value={customConfig.displayField || ''}
                onValueChange={(value) => handleConfigChange('displayField', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field to display" />
                </SelectTrigger>
                <SelectContent>
                  {formFieldOptions.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valueField">Value Field</Label>
              <Select
                value={customConfig.valueField || ''}
                onValueChange={(value) => handleConfigChange('valueField', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field for value" />
                </SelectTrigger>
                <SelectContent>
                  {formFieldOptions.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {customConfig.dataSource === 'api' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="apiEndpoint">API Endpoint</Label>
              <Input
                id="apiEndpoint"
                type="url"
                value={customConfig.apiEndpoint || ''}
                onChange={(e) => handleConfigChange('apiEndpoint', e.target.value)}
                placeholder="https://api.example.com/options"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiHeaders">Custom Headers (JSON)</Label>
              <Textarea
                id="apiHeaders"
                value={JSON.stringify(customConfig.apiHeaders || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const headers = JSON.parse(e.target.value);
                    handleConfigChange('apiHeaders', headers);
                  } catch (error) {
                    // Invalid JSON, don't update
                  }
                }}
                placeholder='{"Authorization": "Bearer token"}'
                rows={3}
              />
            </div>
          </>
        )}

        {customConfig.dataSource === 'field' && (
          <div className="space-y-2">
            <Label htmlFor="dependentField">Dependent Field</Label>
            <Select
              value={customConfig.dependentFieldId || ''}
              onValueChange={(value) => handleConfigChange('dependentFieldId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select controlling field" />
              </SelectTrigger>
              <SelectContent>
                {formFieldOptions.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="cacheTTL">Cache TTL (seconds)</Label>
          <Input
            id="cacheTTL"
            type="number"
            min="0"
            value={customConfig.cacheTTL || 300}
            onChange={(e) => handleConfigChange('cacheTTL', parseInt(e.target.value) || 300)}
            placeholder="300"
          />
          <p className="text-sm text-muted-foreground">
            How long to cache the options (0 to disable caching)
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowEmpty"
            checked={customConfig.allowEmpty !== false}
            onCheckedChange={(checked) => handleConfigChange('allowEmpty', checked)}
          />
          <Label htmlFor="allowEmpty">Allow empty selection</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="searchable"
            checked={customConfig.searchable !== false}
            onCheckedChange={(checked) => handleConfigChange('searchable', checked)}
          />
          <Label htmlFor="searchable">Enable search</Label>
        </div>
      </div>
    </div>
  );
}