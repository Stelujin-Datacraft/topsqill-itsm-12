import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseUserQuery, ParseResult } from '@/services/sqlParser';
import { Loader2, Play, Copy, Check, Save } from 'lucide-react';

// Import CodeMirror editor
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
interface QueryEditorProps {
  onExecute: (sql: string) => void;
  isExecuting: boolean;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}
export const QueryEditor: React.FC<QueryEditorProps> = ({ 
  onExecute, 
  isExecuting,
  value,
  onChange,
  onSave
}) => {
  const [parseResult, setParseResult] = useState<ParseResult>({
    errors: []
  });
  const [isValidating, setIsValidating] = useState(false);
  const [copied, setCopied] = useState(false);
  const validateQuery = useCallback((input: string) => {
    if (!input.trim()) {
      setParseResult({
        errors: []
      });
      return;
    }
    setIsValidating(true);
    try {
      const result = parseUserQuery(input);
      setParseResult(result);
    } catch (error) {
      console.error('Validation error:', error);
      setParseResult({
        errors: ['Validation failed: ' + (error instanceof Error ? error.message : 'Unknown error')]
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
  return <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20 py-[9px]">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">SQL Query</h3>
          {isValidating && <Loader2 className="h-4 w-4 animate-spin" />}
          {!isValidating && isValid && <div className="w-2 h-2 bg-green-500 rounded-full" title="Query is valid" />}
          {!isValidating && parseResult.errors.length > 0 && <div className="w-2 h-2 bg-red-500 rounded-full" title="Query has errors" />}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleCopy} variant="outline" size="sm" className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          
          <Button
            onClick={onSave}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!value.trim()}
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
          
          <Button onClick={handleExecute} disabled={!isValid || isExecuting} size="sm" className="gap-2">
            {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Execute
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden bg-white border border-border rounded-md m-4">
        <div className="h-full min-h-[300px] max-w-full overflow-auto">
          <CodeMirror 
            value={value} 
            height="auto" 
            extensions={[sql()]} 
            onChange={val => onChange(val)} 
            basicSetup={{
              lineNumbers: true,
              highlightActiveLine: true,
              searchKeymap: true,
              autocompletion: true,
              bracketMatching: true,
              closeBrackets: true,
              highlightSelectionMatches: true
            }}
            theme="light"
            style={{
              fontSize: '14px',
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              width: '100%',
              minWidth: '600px'
            }}
          />
        </div>
      </div>

      {/* Help Text */}
      <div className="p-3 border-t border-border bg-muted/10 text-xs text-muted-foreground">
        Press <kbd>Ctrl+Enter</kbd> (or <kbd>Cmd+Enter</kbd> on Mac) to execute • SELECT and UPDATE FORM statements allowed
      </div>

      {/* Errors */}
      {parseResult.errors.length > 0 && <div className="p-3 border-t border-border space-y-2">
          {parseResult.errors.map((error, index) => <Alert key={index} variant="destructive">
              <AlertDescription className="text-sm">
                <span className="font-medium">Parse Error:</span> {error}
              </AlertDescription>
            </Alert>)}
        </div>}

      {/* Generated SQL Preview */}
      {parseResult.sql && parseResult.errors.length === 0 && <div className="p-3 border-t border-border bg-muted/10">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Generated SQL:</h4>
          <pre className="text-xs text-muted-foreground font-mono bg-muted/20 p-2 rounded border overflow-x-auto whitespace-pre-wrap">
            {parseResult.sql.startsWith('UPDATE::BATCH::') ? 'UPDATE query validated (bulk update ready)' : parseResult.sql}
          </pre>
        </div>}

      {/* Example Queries */}
      <div className="p-3 border-t border-border bg-muted/10">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Example Queries:</h4>
        <div className="space-y-1 text-xs text-muted-foreground font-mono">
          <div className="font-semibold mt-2">SELECT queries - Basic:</div>
          <div>SELECT FIELD("field-uuid") FROM "form-uuid"</div>
          <div>SELECT FIELD("name-field"), FIELD("email-field") FROM "form-uuid" WHERE FIELD("status") = 'active'</div>
          <div>SELECT FIELD("price") FROM "form-uuid" ORDER BY FIELD("price") DESC LIMIT 10</div>
          <div>SELECT DISTINCT FIELD("category") FROM "form-uuid"</div>
          
          <div className="font-semibold mt-2">Aggregate Functions:</div>
          <div>SELECT COUNT(FIELD("field-uuid")) FROM "form-uuid"</div>
          <div>SELECT SUM(FIELD("amount")), AVG(FIELD("rating")) FROM "form-uuid"</div>
          <div>SELECT MIN(FIELD("price")), MAX(FIELD("price")) FROM "form-uuid"</div>
          <div>SELECT FIELD("category"), COUNT(FIELD("id")) FROM "form-uuid" GROUP BY FIELD("category")</div>
          <div>SELECT FIELD("status"), AVG(FIELD("score")) FROM "form-uuid" GROUP BY FIELD("status") HAVING AVG(FIELD("score")) &gt; 70</div>
          
          <div className="font-semibold mt-2">String Functions:</div>
          <div>SELECT UPPER(FIELD("name")) FROM "form-uuid"</div>
          <div>SELECT CONCAT(FIELD("first-name"), ' ', FIELD("last-name")) AS full_name FROM "form-uuid"</div>
          <div>SELECT LENGTH(FIELD("description")), TRIM(FIELD("title")) FROM "form-uuid"</div>
          <div>SELECT SUBSTRING(FIELD("code"), 1, 5) AS short_code FROM "form-uuid"</div>
          <div>SELECT REPLACE(FIELD("text"), 'old', 'new') FROM "form-uuid"</div>
          <div>SELECT LEFT(FIELD("email"), 3), RIGHT(FIELD("phone"), 4) FROM "form-uuid"</div>
          
          <div className="font-semibold mt-2">Math Functions:</div>
          <div>SELECT ROUND(FIELD("price"), 2), ABS(FIELD("balance")) FROM "form-uuid"</div>
          <div>SELECT CEIL(FIELD("value")), FLOOR(FIELD("amount")) FROM "form-uuid"</div>
          <div>SELECT MOD(FIELD("quantity"), 10) FROM "form-uuid"</div>
          <div>SELECT SQRT(FIELD("area")), POWER(FIELD("base"), 2) FROM "form-uuid"</div>
          
          <div className="font-semibold mt-2">Date Functions:</div>
          <div>SELECT NOW(), FIELD("created-date") FROM "form-uuid"</div>
          <div>SELECT YEAR(FIELD("date")), MONTH(FIELD("date")), DAY(FIELD("date")) FROM "form-uuid"</div>
          <div>SELECT DATEDIFF(NOW(), FIELD("start-date")) AS days_elapsed FROM "form-uuid"</div>
          
          <div className="font-semibold mt-2">Conditional Functions:</div>
          <div>SELECT IF(FIELD("score") &gt; 70, 'Pass', 'Fail') AS result FROM "form-uuid"</div>
          <div>SELECT COALESCE(FIELD("nickname"), FIELD("full-name"), 'Anonymous') AS display_name FROM "form-uuid"</div>
          
          <div className="font-semibold mt-2">System Columns:</div>
          <div>SELECT submission_id, submitted_by, submitted_at, FIELD("response") FROM "form-uuid"</div>
          
          <div className="font-semibold mt-2">UPDATE queries - Single Record:</div>
          <div>UPDATE FORM "form-uuid" SET FIELD("field-uuid") = 'new-value' WHERE submission_id = "submission-uuid"</div>
          
          <div className="font-semibold mt-2">UPDATE queries - Bulk Update:</div>
          <div>UPDATE FORM "form-uuid" SET FIELD("status") = 'approved' WHERE FIELD("status") = 'pending'</div>
          <div>UPDATE FORM "form-uuid" SET FIELD("target") = FIELD("source") WHERE FIELD("category") = 'active'</div>
          <div>UPDATE FORM "form-uuid" SET FIELD("discount") = '10%' WHERE FIELD("price") &gt; "100"</div>
          
          <div className="font-semibold mt-2">UPDATE with Functions:</div>
          <div>UPDATE FORM "form-uuid" SET FIELD("name") = UPPER(FIELD("name")) WHERE FIELD("type") = 'company'</div>
          <div>UPDATE FORM "form-uuid" SET FIELD("full-name") = CONCAT(FIELD("first"), ' ', FIELD("last")) WHERE submission_id = "uuid"</div>
          <div>UPDATE FORM "form-uuid" SET FIELD("code") = LEFT(FIELD("original-code"), 5) WHERE FIELD("status") = 'active'</div>
          <div>UPDATE FORM "form-uuid" SET FIELD("price") = ROUND(FIELD("price"), 2) WHERE FIELD("category") = 'products'</div>
          <div>UPDATE FORM "form-uuid" SET FIELD("updated-at") = NOW() WHERE FIELD("modified") = 'true'</div>
        </div>
      </div>
    </div>;
};