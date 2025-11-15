import { useState, useEffect, useCallback } from 'react';
import { FormField } from '@/types/form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Play, Database, Eye, EyeOff } from 'lucide-react';
import { executeUserQuery, QueryResult } from '@/services/sqlParser';
import { useToast } from '@/hooks/use-toast';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';

interface QueryFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
  formData?: Record<string, any>;
  onFieldChange?: (fieldId: string, value: any) => void;
}

export function QueryField({ 
  field, 
  value, 
  onChange, 
  error, 
  disabled = false,
  formData = {},
  onFieldChange
}: QueryFieldProps) {
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecuted, setLastExecuted] = useState<string>('');
  const [hasExecutedOnLoad, setHasExecutedOnLoad] = useState(false);
  const { toast } = useToast();

  const customConfig = field.customConfig || {};
  const {
    query = '',
    displayMode = 'data',
    executeOn = 'load',
    targetFieldId = '',
    refreshInterval = 0,
    showResults = true,
    maxResults = 100
  } = customConfig;

  const executeQuery = useCallback(async () => {
    if (!query.trim()) {
      console.warn('⚠️ QueryField: No query configured');
      return;
    }

    console.log('🔄 QueryField: Starting query execution');
    console.log('   Query:', query);
    console.log('   Execute On:', executeOn);
    console.log('   Target Field:', targetFieldId);
    console.log('   Form Data:', formData);

    setIsExecuting(true);
    const startTime = Date.now();
    
    try {
      const result = await executeUserQuery(query);
      console.log(`✅ QueryField: Query executed successfully in ${Date.now() - startTime}ms`);
      console.log('   Rows returned:', result.rows.length);
      console.log('   Columns:', result.columns);
      
      setQueryResult(result);
      setLastExecuted(new Date().toISOString());
      
      if (result.errors.length > 0) {
        console.error('❌ QueryField: Query returned errors:', result.errors);
        toast({
          title: "Query Execution Error",
          description: result.errors.join(', '),
          variant: "destructive",
        });
      } else if (onChange) {
        // Store the result in the field value
        onChange({
          result,
          executedAt: new Date().toISOString(),
          query
        });
      }
    } catch (error) {
      console.error('❌ QueryField: Query execution failed:', error);
      toast({
        title: "Query Error",
        description: error instanceof Error ? error.message : "Failed to execute query",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  }, [query, onChange, toast, executeOn, targetFieldId, formData]);

  // Initialize hasExecutedOnLoad for field-change mode (needs to be ready before changes occur)
  useEffect(() => {
    if (executeOn === 'field-change' && !hasExecutedOnLoad) {
      console.log('🎬 QueryField: Initializing field-change mode');
      setHasExecutedOnLoad(true);
    }
  }, [executeOn, hasExecutedOnLoad]);

  // Execute on load - only once
  useEffect(() => {
    if (executeOn === 'load' && query.trim() && !hasExecutedOnLoad) {
      console.log('🚀 QueryField: Executing query on load');
      executeQuery();
      setHasExecutedOnLoad(true);
    }
  }, [executeOn, query, hasExecutedOnLoad, executeQuery]);

  // Execute on field change - track target field value
  const targetFieldValue = targetFieldId ? formData?.[targetFieldId] : undefined;
  
  useEffect(() => {
    if (executeOn === 'field-change' && targetFieldId && hasExecutedOnLoad) {
      console.log('🎯 QueryField: Target field changed');
      console.log('   Target Field ID:', targetFieldId);
      console.log('   New Value:', targetFieldValue);
      console.log('   Full Form Data:', formData);
      executeQuery();
    }
  }, [targetFieldValue, executeOn, targetFieldId, hasExecutedOnLoad, executeQuery]);

  // Auto-refresh interval - only if not submit mode
  useEffect(() => {
    if (refreshInterval > 0 && query.trim() && executeOn !== 'submit') {
      console.log(`⏰ QueryField: Setting up auto-refresh every ${refreshInterval} seconds`);
      const interval = setInterval(() => {
        console.log('🔄 QueryField: Auto-refresh triggered');
        executeQuery();
      }, refreshInterval * 1000);
      return () => {
        console.log('⏰ QueryField: Clearing auto-refresh');
        clearInterval(interval);
      };
    }
  }, [refreshInterval, query, executeOn, executeQuery]);

  const handleManualExecute = () => {
    if (executeOn === 'submit') {
      toast({
        title: "Manual Execution",
        description: "This query is configured to run on form submission only",
        variant: "default",
      });
      return;
    }
    executeQuery();
    // Reset the onload flag so it can execute again if needed
    if (executeOn === 'load') {
      setHasExecutedOnLoad(true);
    }
  };

  const renderQueryDisplay = () => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Query</Label>
      <div className="border rounded-md">
        <CodeMirror
          value={query}
          height="120px"
          extensions={[sql()]}
          editable={false}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLineGutter: false,
          }}
        />
      </div>
    </div>
  );

  const renderDataDisplay = () => {
    if (!showResults) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Query Results</Label>
          <div className="flex items-center gap-2">
            {lastExecuted && (
              <span className="text-xs text-muted-foreground">
                Last executed: {new Date(lastExecuted).toLocaleString()}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualExecute}
              disabled={disabled || isExecuting || !query.trim()}
            >
              {isExecuting ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Play className="h-3 w-3 mr-1" />
              )}
              Execute
            </Button>
          </div>
        </div>

        {queryResult ? (
          queryResult.errors.length > 0 ? (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive font-medium">Errors:</p>
              <ul className="text-sm text-destructive mt-1">
                {queryResult.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="border rounded-md">
              <div className="p-3 bg-muted/50 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {queryResult.rows.length} row(s) returned
                    </span>
                  </div>
                  {queryResult.columns.length > 0 && (
                    <Badge variant="secondary">
                      {queryResult.columns.length} column(s)
                    </Badge>
                  )}
                </div>
              </div>
              
              {queryResult.rows.length > 0 ? (
                <div className="p-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          {queryResult.columns.map((column, index) => (
                            <th key={index} className="text-left p-2 font-medium">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows.slice(0, maxResults).map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b border-border/50">
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="p-2">
                                {cell !== null && cell !== undefined ? String(cell) : '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {queryResult.rows.length > maxResults && (
                    <div className="mt-2 text-xs text-muted-foreground text-center">
                      Showing first {maxResults} of {queryResult.rows.length} rows
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No data returned</p>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="p-8 text-center text-muted-foreground border rounded-md border-dashed">
            <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No query executed yet</p>
            {query.trim() && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={handleManualExecute}
                disabled={disabled || isExecuting}
              >
                {isExecuting ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                Execute Query
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {/* <Label htmlFor={field.id} className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label> */}
        <div className="flex items-center gap-2">
          {executeOn && (
            <Badge variant="outline" className="text-xs">
              Execute on: {executeOn.replace('-', ' ')}
            </Badge>
          )}
          {refreshInterval > 0 && (
            <Badge variant="outline" className="text-xs">
              Refresh: {refreshInterval}s
            </Badge>
          )}
        </div>
      </div>

      {field.tooltip && (
        <p className="text-sm text-muted-foreground">{field.tooltip}</p>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          {displayMode === 'query' && renderQueryDisplay()}
          {displayMode === 'data' && renderDataDisplay()}
          {displayMode === 'query' && showResults && (
            <>
              <Separator />
              {renderDataDisplay()}
            </>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}