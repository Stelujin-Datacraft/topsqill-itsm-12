import { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useSavedQueries } from '@/hooks/useSavedQueries';
import { useForm } from '@/contexts/FormContext';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { Database, Play, FileText, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface QueryFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
}

export function QueryFieldConfig({ config, onUpdate, errors }: QueryFieldConfigProps) {
  const customConfig = config.customConfig || {};
  const { savedQueries, isLoading: savedQueriesLoading } = useSavedQueries();
  const { currentForm } = useForm();
  const [availableFields, setAvailableFields] = useState<FormField[]>([]);

  useEffect(() => {
    // Get all fields from current form for field change targeting
    if (currentForm?.fields) {
      setAvailableFields(currentForm.fields.filter(field => field.id !== config.label));
    }
  }, [currentForm, config.label]);

  const updateCustomConfig = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value
      }
    });
  };

  const handleSavedQuerySelect = (savedQueryId: string) => {
    const selectedQuery = savedQueries.find(q => q.id === savedQueryId);
    if (selectedQuery) {
      updateCustomConfig('savedQueryId', savedQueryId);
      updateCustomConfig('query', selectedQuery.query);
    }
  };

  const clearSavedQuery = () => {
    updateCustomConfig('savedQueryId', '');
  };

  return (
    <div className="space-y-6">
      {/* Basic Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Query Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Saved Query Selection */}
          <div className="space-y-2">
            <Label>Saved Query</Label>
            <div className="flex gap-2">
              <Select
                value={customConfig.savedQueryId || ''}
                onValueChange={handleSavedQuerySelect}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={savedQueriesLoading ? "Loading..." : "Select a saved query"} />
                </SelectTrigger>
                <SelectContent>
                  {savedQueries.map((query) => (
                    <SelectItem key={query.id} value={query.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        {query.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customConfig.savedQueryId && (
                <Button variant="outline" size="sm" onClick={clearSavedQuery}>
                  Clear
                </Button>
              )}
            </div>
            {customConfig.savedQueryId && (
              <Badge variant="secondary" className="text-xs">
                Using saved query: {savedQueries.find(q => q.id === customConfig.savedQueryId)?.name}
              </Badge>
            )}
          </div>

          {/* Custom Query */}
          <div className="space-y-2">
            <Label>Custom Query</Label>
            <div className="border rounded-md">
              <CodeMirror
                value={customConfig.query || ''}
                height="200px"
                extensions={[sql()]}
                onChange={(value) => updateCustomConfig('query', value)}
                placeholder="SELECT * FROM form_submissions WHERE..."
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: false,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Use custom SQL syntax or SELECT queries to retrieve data from form submissions
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Display Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Display Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Display Mode */}
          <div className="space-y-2">
            <Label>Display Mode</Label>
            <Select
              value={customConfig.displayMode || 'data'}
              onValueChange={(value) => updateCustomConfig('displayMode', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="data">Show Query Results</SelectItem>
                <SelectItem value="query">Show Query Code</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Show Results Toggle */}
          <div className="flex items-center justify-between">
            <Label>Show Query Results</Label>
            <Switch
              checked={customConfig.showResults !== false}
              onCheckedChange={(checked) => updateCustomConfig('showResults', checked)}
            />
          </div>

          {/* Max Results */}
          <div className="space-y-2">
            <Label>Maximum Results to Display</Label>
            <Input
              type="number"
              min="1"
              max="1000"
              value={customConfig.maxResults || 100}
              onChange={(e) => updateCustomConfig('maxResults', parseInt(e.target.value) || 100)}
            />
            <p className="text-xs text-muted-foreground">
              Limit the number of rows displayed in the results table
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Execution Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4" />
            Execution Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Execute On */}
          <div className="space-y-2">
            <Label>Execute Query On</Label>
            <Select
              value={customConfig.executeOn || 'load'}
              onValueChange={(value) => updateCustomConfig('executeOn', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="load">Form Load</SelectItem>
                <SelectItem value="submit">Form Submit</SelectItem>
                <SelectItem value="field-change">Field Change</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Target Field for Field Change */}
          {customConfig.executeOn === 'field-change' && (
            <div className="space-y-2">
              <Label>Target Field</Label>
              <Select
                value={customConfig.targetFieldId || ''}
                onValueChange={(value) => updateCustomConfig('targetFieldId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field to watch for changes" />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.label} ({field.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Query will execute when this field's value changes
              </p>
            </div>
          )}

          <Separator />

          {/* Auto Refresh */}
          <div className="space-y-2">
            <Label>Auto Refresh Interval (seconds)</Label>
            <Input
              type="number"
              min="0"
              value={customConfig.refreshInterval || 0}
              onChange={(e) => updateCustomConfig('refreshInterval', parseInt(e.target.value) || 0)}
              placeholder="0 = disabled"
            />
            <p className="text-xs text-muted-foreground">
              Set to 0 to disable auto-refresh. Minimum recommended interval is 30 seconds.
            </p>
            {(customConfig.refreshInterval || 0) > 0 && (customConfig.refreshInterval || 0) < 30 && (
              <p className="text-xs text-yellow-600">
                Warning: Short refresh intervals may impact performance
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {Object.keys(errors).length > 0 && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="text-sm text-destructive">
              <p className="font-medium mb-2">Configuration Errors:</p>
              <ul className="space-y-1">
                {Object.entries(errors).map(([field, error]) => (
                  <li key={field}>• {error}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}