
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseUserQuery, ParseResult } from '@/services/sqlParser';
import { Loader2, Play, Copy, Check } from 'lucide-react';

// Import CodeMirror editor
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';

interface QueryEditorProps {
  onExecute: (sql: string) => void;
  isExecuting: boolean;
  value: string;
  onChange: (value: string) => void;
}

export const QueryEditor: React.FC<QueryEditorProps> = ({
  onExecute,
  isExecuting,
  value,
  onChange,
}) => {
  const [parseResult, setParseResult] = useState<ParseResult>({ errors: [] });
  const [isValidating, setIsValidating] = useState(false);
  const [copied, setCopied] = useState(false);

  const validateQuery = useCallback((input: string) => {
    if (!input.trim()) {
      setParseResult({ errors: [] });
      return;
    }
    setIsValidating(true);
    try {
      const result = parseUserQuery(input);
      setParseResult(result);
    } catch (error) {
      console.error('Validation error:', error);
      setParseResult({
        errors: ['Validation failed: ' + (error instanceof Error ? error.message : 'Unknown error')],
      });
    } finally {
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateQuery(value);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [value, validateQuery]);

  const handleExecute = () => {
    const isValid = parseResult.sql && parseResult.errors.length === 0;
    if (!isValid || isExecuting) return;
    onExecute(parseResult.sql!);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const isValid = parseResult.sql && parseResult.errors.length === 0;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">SQL Query</h3>
          {isValidating && <Loader2 className="h-4 w-4 animate-spin" />}
          {!isValidating && isValid && (
            <div className="w-2 h-2 bg-green-500 rounded-full" title="Query is valid" />
          )}
          {!isValidating && parseResult.errors.length > 0 && (
            <div className="w-2 h-2 bg-red-500 rounded-full" title="Query has errors" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleCopy} variant="outline" size="sm" className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button onClick={handleExecute} disabled={!isValid || isExecuting} size="sm" className="gap-2">
            {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Execute
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 p-4 overflow-hidden">
        <CodeMirror
          value={value}
          height="100%"
          extensions={[sql(), oneDark]}
          onChange={(val) => onChange(val)}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
          }}
          theme={oneDark}
        />
      </div>

      {/* Help Text */}
      <div className="p-3 border-t border-border bg-muted/10 text-xs text-muted-foreground">
        Press <kbd>Ctrl+Enter</kbd> (or <kbd>Cmd+Enter</kbd> on Mac) to execute • Only SELECT statements allowed
      </div>

      {/* Errors */}
      {parseResult.errors.length > 0 && (
        <div className="p-3 border-t border-border space-y-2">
          {parseResult.errors.map((error, index) => (
            <Alert key={index} variant="destructive">
              <AlertDescription className="text-sm">
                <span className="font-medium">Parse Error:</span> {error}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Generated SQL Preview */}
      {parseResult.sql && parseResult.errors.length === 0 && (
        <div className="p-3 border-t border-border bg-muted/10">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Generated SQL:</h4>
          <pre className="text-xs text-muted-foreground font-mono bg-muted/20 p-2 rounded border overflow-x-auto whitespace-pre-wrap">
            {parseResult.sql}
          </pre>
        </div>
      )}

      {/* Example Queries */}
      <div className="p-3 border-t border-border bg-muted/10">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Example Queries:</h4>
        <div className="space-y-1 text-xs text-muted-foreground font-mono">
          <div>SELECT "field-uuid" FROM "form-uuid"</div>
          <div>SELECT COUNT(*) FROM "form-uuid"</div>
          <div>SELECT SUM("amount-field-uuid") FROM "form-uuid"</div>
          <div>SELECT "name-field" FROM "form-uuid" WHERE "status-field" = 'approved'</div>
        </div>
      </div>
    </div>
  );
};
