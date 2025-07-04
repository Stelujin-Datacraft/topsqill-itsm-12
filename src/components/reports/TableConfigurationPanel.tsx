
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Form } from '@/types/form';
import { SimpleFormSelector } from './SimpleFormSelector';

interface TableConfig {
  title: string;
  description: string;
  primaryFormId: string;
  selectedColumns: string[];
  showMetadata: boolean;
  pageSize: number;
  enableSearch: boolean;
  enableSorting: boolean;
  enableFiltering: boolean;
  enableExport: boolean;
}

interface TableConfigurationPanelProps {
  config: TableConfig;
  onConfigChange: (config: TableConfig) => void;
  forms: Form[];
  loading?: boolean;
  showColumnSelection?: boolean;
}

export function TableConfigurationPanel({
  config,
  onConfigChange,
  forms,
  loading = false,
  showColumnSelection = false
}: TableConfigurationPanelProps) {
  const handleBasicConfigChange = (key: keyof TableConfig, value: any) => {
    onConfigChange({
      ...config,
      [key]: value
    });
  };

  const handleFormSelect = (formId: string) => {
    onConfigChange({
      ...config,
      primaryFormId: formId,
      selectedColumns: [] // Clear columns when form changes
    });
  };

  // This component is now simplified and used only for basic configuration
  // Column selection is handled by the dedicated ColumnSelector component
  return (
    <div className="space-y-6">
      {/* Basic Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="table-title">Report Title *</Label>
            <Input
              id="table-title"
              value={config.title}
              onChange={(e) => handleBasicConfigChange('title', e.target.value)}
              placeholder="Enter report title"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="table-description">Description</Label>
            <Textarea
              id="table-description"
              value={config.description}
              onChange={(e) => handleBasicConfigChange('description', e.target.value)}
              placeholder="Describe your table report"
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <div className="space-y-4">
          <SimpleFormSelector
            forms={forms}
            selectedFormId={config.primaryFormId}
            onFormSelect={handleFormSelect}
            disabled={loading}
          />

          <div>
            <Label>Page Size</Label>
            <select
              value={config.pageSize}
              onChange={(e) => handleBasicConfigChange('pageSize', parseInt(e.target.value))}
              className="mt-1 w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Table Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-metadata"
                checked={config.showMetadata}
                onCheckedChange={(checked) => handleBasicConfigChange('showMetadata', !!checked)}
              />
              <Label htmlFor="show-metadata" className="text-sm">Show metadata columns</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enable-search"
                checked={config.enableSearch}
                onCheckedChange={(checked) => handleBasicConfigChange('enableSearch', !!checked)}
              />
              <Label htmlFor="enable-search" className="text-sm">Enable search</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enable-sorting"
                checked={config.enableSorting}
                onCheckedChange={(checked) => handleBasicConfigChange('enableSorting', !!checked)}
              />
              <Label htmlFor="enable-sorting" className="text-sm">Enable sorting</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enable-filtering"
                checked={config.enableFiltering}
                onCheckedChange={(checked) => handleBasicConfigChange('enableFiltering', !!checked)}
              />
              <Label htmlFor="enable-filtering" className="text-sm">Enable filtering</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enable-export"
                checked={config.enableExport}
                onCheckedChange={(checked) => handleBasicConfigChange('enableExport', !!checked)}
              />
              <Label htmlFor="enable-export" className="text-sm">Enable export</Label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
