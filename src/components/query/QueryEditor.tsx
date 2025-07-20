
import React, { useState, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseUserQuery, ParseError } from '@/services/sqlParser';
import { schemaCache } from '@/services/schemaCache';
import { Loader2, Play } from 'lucide-react';

interface QueryEditorProps {
  onExecute: (sql: string) => void;
  isExecuting: boolean;
}

export const QueryEditor: React.FC<QueryEditorProps> = ({ onExecute, isExecuting }) => {
  const [query, setQuery] = useState('');
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(false);

  const validateQuery = useCallback(async (input: string) => {
    if (!input.trim()) {
      setErrors([]);
      setIsValid(false);
      return;
    }

    setIsValidating(true);
    try {
      const cache = await schemaCache.getCache();
      const result = parseUserQuery(input, cache);
      
      setErrors(result.errors);
      setIsValid(result.errors.length === 0 && !!result.sql);
    } catch (error) {
      console.error('Validation error:', error);
      setErrors([{
        message: 'Validation failed',
        position: 0,
        type: 'syntax'
      }]);
      setIsValid(false);
    } finally {
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateQuery(query);
    }, 500); // Debounce validation

    return () => clearTimeout(timeoutId);
  }, [query, validateQuery]);

  const handleExecute = async () => {
    if (!isValid || isExecuting) return;
    
    try {
      const cache = await schemaCache.getCache();
      const result = parseUserQuery(query, cache);
      
      if (result.sql) {
        onExecute(result.sql);
      }
    } catch (error) {
      console.error('Execute error:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleExecute();
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">SQL Query</h3>
          <div className="flex items-center gap-2">
            {isValidating && <Loader2 className="h-4 w-4 animate-spin" />}
            <Button
              onClick={handleExecute}
              disabled={!isValid || isExecuting}
              size="sm"
              className="gap-2"
            >
              {isExecuting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Execute
            </Button>
          </div>
        </div>
        
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="SELECT &quot;field-id&quot; FROM &quot;form-id&quot; WHERE..."
          className="min-h-[120px] font-mono text-sm resize-none"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}
        />
        
        <div className="text-xs text-muted-foreground">
          Press Ctrl+Enter (Cmd+Enter on Mac) to execute • Only SELECT statements allowed
        </div>
      </div>

      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((error, index) => (
            <Alert key={index} variant="destructive">
              <AlertDescription className="text-sm">
                <span className="font-medium">{error.type === 'syntax' ? 'Syntax Error' : 
                  error.type === 'unknown_field' ? 'Unknown Field' : 
                  error.type === 'unknown_form' ? 'Unknown Form' : 'Error'}:</span> {error.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Example Queries:</h4>
        <div className="space-y-1 text-xs text-muted-foreground font-mono">
          <div>SELECT "field-uuid" FROM "form-uuid";</div>
          <div>SELECT COUNT(*) FROM "form-uuid" WHERE "status" = 'approved';</div>
          <div>SELECT SUM("amount") FROM "form-uuid" WHERE submitted_at &gt; '2025-01-01';</div>
          <div>SELECT submission_id, "rating" FROM "form-uuid" WHERE "rating" &gt;= 4;</div>
        </div>
      </div>
    </div>
  );
};
