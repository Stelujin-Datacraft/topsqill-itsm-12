import { useState, useRef } from 'react';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSavedQueries } from '@/hooks/useSavedQueries';
import { useCurrentFormFields } from '@/hooks/useCurrentFormFields';
import { QueryTemplates } from '@/components/query/QueryTemplates';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { Database, FileText, Eye, RefreshCw, Plus, Code2, HelpCircle, BookOpen, BarChart3, Search, Check } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { EditorView } from '@codemirror/view';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [fieldSearchOpen, setFieldSearchOpen] = useState(false);
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
      const textToInsert = `FIELD("${fieldToInsert.value}")`;
      
      view.dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: textToInsert
        },
        selection: { anchor: selection.from + textToInsert.length }
      });
      
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
    
    const newQuery = view.state.doc.toString();
    updateCustomConfig('query', newQuery);
  };

  const handleTemplateSelect = (query: string) => {
    updateCustomConfig('query', query);
    if (customConfig.savedQueryId) {
      updateCustomConfig('savedQueryId', '');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Query Field - Dynamic Data Display
          </CardTitle>
          <CardDescription className="text-xs">
            Execute SQL-like queries on form submissions and display results dynamically. 
            Perfect for dashboards, reports, and data summaries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <p className="font-semibold">Use Cases:</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Dynamic lookups</li>
                <li>Real-time calculations</li>
                <li>Form summaries</li>
                <li>Data dashboards</li>
              </ul>
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Features:</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Auto-refresh</li>
                <li>Field-based triggers</li>
                <li>Aggregations (SUM, AVG, COUNT)</li>
                <li>Filtering & sorting</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="config">
            <Database className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Code2 className="h-4 w-4 mr-2" />
            Templates & Guide
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                Query Configuration
              </CardTitle>
              <CardDescription className="text-xs">
                Write SQL queries to fetch and display data from form submissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Saved Queries (Optional)</Label>
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

              <div className="space-y-3 p-3 bg-muted/30 rounded-md border">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Query Helper</Label>
                  <Badge variant="outline" className="text-xs">Insert IDs into query</Badge>
                </div>
                
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

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Insert Field ID</Label>
                  <div className="flex gap-2">
                    <Popover open={fieldSearchOpen} onOpenChange={setFieldSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={fieldSearchOpen}
                          className="flex-1 justify-between font-normal"
                        >
                          {selectedFieldForInsert ? (
                            <span className="truncate">
                              {formFieldOptions.find(f => f.value === selectedFieldForInsert)?.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Select a field...</span>
                          )}
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search fields..." />
                          <CommandList className="max-h-[300px]">
                            <CommandEmpty>No field found.</CommandEmpty>
                            <CommandGroup>
                              {formFieldOptions.map((field) => (
                                <CommandItem
                                  key={field.value}
                                  value={field.label}
                                  onSelect={() => {
                                    setSelectedFieldForInsert(field.value);
                                    setFieldSearchOpen(false);
                                  }}
                                  className="flex items-center justify-between"
                                >
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="font-medium truncate">{field.label}</span>
                                    <span className="text-xs text-muted-foreground font-mono truncate">{field.value}</span>
                                  </div>
                                  <Check
                                    className={cn(
                                      "ml-2 h-4 w-4 shrink-0",
                                      selectedFieldForInsert === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
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
                    Search and select a field, then click + to insert its ID at the cursor position
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">SQL Query</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 text-xs">
                          <BookOpen className="h-3 w-3 mr-1" />
                          Quick Tips
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-sm">
                        <div className="space-y-2 text-xs">
                          <p className="font-semibold">Query Syntax:</p>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Use "{'{field-id}'}" to reference fields</li>
                            <li>Use "{'{form-id}'}" to reference forms</li>
                            <li>Supports WHERE, ORDER BY, LIMIT</li>
                            <li>Supports COUNT, SUM, AVG, GROUP BY</li>
                          </ul>
                          <p className="text-muted-foreground pt-1">
                            See "Templates & Guide" tab for examples
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="border rounded-md">
                  <CodeMirror
                    value={customConfig.query || ''}
                    height="200px"
                    extensions={[sql()]}
                    onChange={(value) => {
                      updateCustomConfig('query', value);
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
                      foldGutter: false,
                    }}
                  />
                </div>
                {errors.query && (
                  <p className="text-xs text-destructive">{errors.query}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Display Options
              </CardTitle>
              <CardDescription className="text-xs">
                Configure how query results are displayed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm">Show Query Code</Label>
                  <p className="text-xs text-muted-foreground">Display the SQL query to users</p>
                </div>
                <Switch
                  checked={customConfig.displayMode !== 'data'}
                  onCheckedChange={(checked) =>
                    updateCustomConfig('displayMode', checked ? 'code-and-data' : 'data')
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm">Show Results</Label>
                  <p className="text-xs text-muted-foreground">Display query results</p>
                </div>
                <Switch
                  checked={customConfig.showResults !== false}
                  onCheckedChange={(checked) =>
                    updateCustomConfig('showResults', checked)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Maximum Results</Label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={customConfig.maxResults || 100}
                  onChange={(e) =>
                    updateCustomConfig('maxResults', parseInt(e.target.value) || 100)
                  }
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">
                  Limit the number of rows displayed (1-1000)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Execution Options
              </CardTitle>
              <CardDescription className="text-xs">
                Control when and how the query executes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Execute Query</Label>
                <Select
                  value={customConfig.executeOn || 'load'}
                  onValueChange={(value) => updateCustomConfig('executeOn', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="load">On Load</SelectItem>
                    <SelectItem value="field-change">On Field Change</SelectItem>
                    <SelectItem value="submit">On Submit</SelectItem>
                    <SelectItem value="manual">Manual Only</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {customConfig.executeOn === 'load' && 'Query runs automatically when the form loads'}
                  {customConfig.executeOn === 'field-change' && 'Query runs when a target field changes'}
                  {customConfig.executeOn === 'submit' && 'Query runs when the form is submitted'}
                  {customConfig.executeOn === 'manual' && 'Query only runs when manually triggered'}
                </p>
              </div>

              {customConfig.executeOn === 'field-change' && (
                <div className="space-y-2">
                  <Label className="text-sm">Target Field</Label>
                  <Select
                    value={customConfig.targetFieldId || ''}
                    onValueChange={(value) => updateCustomConfig('targetFieldId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a field to watch" />
                    </SelectTrigger>
                    <SelectContent>
                      {formFieldOptions.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Query will execute whenever this field's value changes
                  </p>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm">Auto-Refresh Interval (seconds)</Label>
                <Input
                  type="number"
                  min="0"
                  value={customConfig.refreshInterval === undefined ? '' : customConfig.refreshInterval}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateCustomConfig('refreshInterval', value === '' ? 0 : parseInt(value) || 0);
                  }}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Set to 0 to disable auto-refresh. Query will re-execute at this interval.
                </p>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Enable Query Validation</Label>
                  <Switch
                    checked={customConfig.enableValidation !== false}
                    onCheckedChange={(checked) => updateCustomConfig('enableValidation', checked)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Validates SQL syntax and shows warnings before execution
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Display Options
              </CardTitle>
              <CardDescription className="text-xs">
                Customize how query results are displayed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Chart Type</Label>
                <Select
                  value={customConfig.chartType || 'none'}
                  onValueChange={(value) => updateCustomConfig('chartType', value === 'none' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Chart</SelectItem>
                    <SelectItem value="bar">Bar Chart - Compare categories</SelectItem>
                    <SelectItem value="line">Line Chart - Show trends</SelectItem>
                    <SelectItem value="pie">Pie Chart - Show distribution</SelectItem>
                  </SelectContent>
                </Select>
                
                {customConfig.chartType && (
                  <div className="p-2 bg-muted/50 rounded-md text-xs space-y-1">
                    <p className="font-medium">Chart Requirements:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      <li>First column = labels/categories (text)</li>
                      <li>Second column+ = values (numbers)</li>
                      {customConfig.chartType === 'pie' && (
                        <>
                          <li>Best with ≤10 categories</li>
                          <li>Values should be positive</li>
                        </>
                      )}
                      {customConfig.chartType === 'line' && (
                        <li>Best with sequential/time data</li>
                      )}
                      {customConfig.chartType === 'bar' && (
                        <li>Supports multiple value columns</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm">Max Results</Label>
                <Input
                  type="number"
                  min="10"
                  max="1000"
                  value={customConfig.maxResults || 100}
                  onChange={(e) =>
                    updateCustomConfig('maxResults', parseInt(e.target.value) || 100)
                  }
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of rows to display (default: 100)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                Query Variables
              </CardTitle>
              <CardDescription className="text-xs">
                Use dynamic variables in your queries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-xs space-y-1">
                  <p className="font-medium">Available Variables:</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded">@current_user</code>
                    <code className="text-xs bg-muted px-2 py-1 rounded">@current_user_email</code>
                    <code className="text-xs bg-muted px-2 py-1 rounded">@today</code>
                    <code className="text-xs bg-muted px-2 py-1 rounded">@now</code>
                    <code className="text-xs bg-muted px-2 py-1 rounded">@form_id</code>
                    <code className="text-xs bg-muted px-2 py-1 rounded">@submission_id</code>
                    <code className="text-xs bg-muted px-2 py-1 rounded">@yesterday</code>
                    <code className="text-xs bg-muted px-2 py-1 rounded">@this_week_start</code>
                    <code className="text-xs bg-muted px-2 py-1 rounded">@this_month_start</code>
                    <code className="text-xs bg-muted px-2 py-1 rounded">@this_year_start</code>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Use these variables in your queries - they will be replaced with actual values at runtime
                </p>
                <div className="mt-3 p-2 bg-muted rounded text-xs">
                  <p className="font-medium mb-1">Example:</p>
                  <code className="text-xs">
                    SELECT * FROM submissions<br/>
                    WHERE submitted_by = @current_user<br/>
                    AND submitted_at &gt;= @this_week_start
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <QueryTemplates 
            onSelectTemplate={handleTemplateSelect}
            currentFormId={currentForm?.id}
          />
        </TabsContent>
      </Tabs>

      {Object.keys(errors).length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-sm text-destructive">Configuration Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {Object.entries(errors).map(([field, error]) => (
                <li key={field} className="text-destructive">
                  • {error}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
