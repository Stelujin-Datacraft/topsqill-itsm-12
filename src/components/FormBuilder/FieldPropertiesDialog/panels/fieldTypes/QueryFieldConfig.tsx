import { useState, useRef } from 'react';
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
import { useCurrentFormFields } from '@/hooks/useCurrentFormFields';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { Database, Play, FileText, Eye, EyeOff, RefreshCw, Plus } from 'lucide-react';
import type { EditorView } from '@codemirror/view';

interface QueryFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
}

export function QueryFieldConfig({ config, onUpdate, errors }: QueryFieldConfigProps) {
  const customConfig = config.customConfig || {};
  const { savedQueries, isLoading: savedQueriesLoading } = useSavedQueries();
  const { formFieldOptions, currentForm } = useCurrentFormFields();
  const [selectedFieldForInsert, setSelectedFieldForInsert] = useState<string>('');
  const editorViewRef = useRef<EditorView | null>(null);

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

  const insertFieldIdAtCursor = () => {
    if (!selectedFieldForInsert || !editorViewRef.current) return;
    
    const view = editorViewRef.current;
    const selection = view.state.selection.main;
    const fieldToInsert = formFieldOptions.find(f => f.value === selectedFieldForInsert);
    
    if (fieldToInsert) {
      // Insert as "field-id" in the query
      const textToInsert = `"${fieldToInsert.value}"`;
      
      view.dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: textToInsert
        },
        selection: { anchor: selection.from + textToInsert.length }
      });
      
      // Update the config with the modified query
      const newQuery = view.state.doc.toString();
      updateCustomConfig('query', newQuery);
    }
  };

  const insertFormIdAtCursor = () => {
    if (!currentForm?.id || !editorViewRef.current) return;
    
    const view = editorViewRef.current;
    const selection = view.state.selection.main;
    const textToInsert = `"${currentForm.id}"`;
    
    view.dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert: textToInsert
      },
      selection: { anchor: selection.from + textToInsert.length }
    });
    
    // Update the config with the modified query
    const newQuery = view.state.doc.toString();
    updateCustomConfig('query', newQuery);
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

          {/* Form and Field Reference Helper */}
          <div className="space-y-3 p-3 bg-muted/30 rounded-md border">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Query Helper</Label>
              <Badge variant="outline" className="text-xs">Insert IDs into query</Badge>
            </div>
            
            {/* Current Form ID */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Current Form ID</Label>
              <div className="flex gap-2">
                <Input 
                  value={currentForm?.id || 'No form loaded'} 
                  readOnly 
                  className="flex-1 text-xs font-mono bg-background"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={insertFormIdAtCursor}
                  disabled={!currentForm?.id}
                  title="Insert form ID at cursor"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Field Selector */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Insert Field ID</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedFieldForInsert}
                  onValueChange={setSelectedFieldForInsert}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a field..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {formFieldOptions.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{field.label}</span>
                          <span className="text-xs text-muted-foreground font-mono">{field.value}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={insertFieldIdAtCursor}
                  disabled={!selectedFieldForInsert}
                  title="Insert field ID at cursor"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Select a field and click + to insert its ID at cursor position
              </p>
            </div>
          </div>

          {/* Custom Query */}
          <div className="space-y-2">
            <Label>Custom Query</Label>
            <div className="border rounded-md">
              <CodeMirror
                value={customConfig.query || ''}
                height="200px"
                extensions={[sql()]}
                onChange={(value) => {
                  updateCustomConfig('query', value);
                  // Clear saved query when manually editing
                  if (customConfig.savedQueryId) {
                    updateCustomConfig('savedQueryId', '');
                  }
                }}
                onCreateEditor={(view) => {
                  editorViewRef.current = view;
                }}
                placeholder="SELECT * FROM form_submissions WHERE..."
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: false,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Use custom SQL or SELECT queries. Use the helper above to insert form/field IDs dynamically.
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
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="display-data"
                  name="displayMode"
                  value="data"
                  checked={customConfig.displayMode === 'data' || !customConfig.displayMode}
                  onChange={(e) => updateCustomConfig('displayMode', e.target.value)}
                />
                <Label htmlFor="display-data">Show Query Results Only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="display-query"
                  name="displayMode"
                  value="query"
                  checked={customConfig.displayMode === 'query'}
                  onChange={(e) => updateCustomConfig('displayMode', e.target.value)}
                />
                <Label htmlFor="display-query">Show Query Code & Results</Label>
              </div>
            </div>
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
                  {formFieldOptions.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
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