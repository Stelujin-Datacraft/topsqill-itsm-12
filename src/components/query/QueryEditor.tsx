import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { parseUserQuery, ParseResult } from '@/services/sqlParser';
import { Loader2, Play, Copy, Check, Save, ChevronDown, ChevronUp, Wand2, Keyboard } from 'lucide-react';
import { formatSQL } from '@/utils/queryFormatter';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { useToast } from '@/hooks/use-toast';

// Import CodeMirror editor
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';

interface QueryEditorProps {
  onExecute: (sql: string) => void;
  isExecuting: boolean;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export interface QueryEditorRef {
  insertAtCursor: (text: string) => void;
}

export const QueryEditor = forwardRef<QueryEditorRef, QueryEditorProps>(({ 
  onExecute, 
  isExecuting,
  value,
  onChange,
  onSave
}, ref) => {
  const editorViewRef = useRef<EditorView | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult>({
    errors: []
  });
  const [isValidating, setIsValidating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { toast } = useToast();

  // Expose insertAtCursor method via ref
  useImperativeHandle(ref, () => ({
    insertAtCursor: (text: string) => {
      if (editorViewRef.current) {
        const view = editorViewRef.current;
        const { from } = view.state.selection.main;
        view.dispatch({
          changes: { from, insert: text },
          selection: { anchor: from + text.length }
        });
      } else {
        // Fallback if editor view not available
        onChange(value + text);
      }
    }
  }));

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

  const handleFormat = () => {
    try {
      const formatted = formatSQL(value);
      onChange(formatted);
      toast({
        title: "Query formatted",
        description: "Your SQL query has been formatted"
      });
    } catch (error) {
      toast({
        title: "Format failed",
        description: "Could not format the query",
        variant: "destructive"
      });
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    // Ctrl+Enter: Execute
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      handleExecute();
    }
    // Ctrl+S: Save
    else if (event.ctrlKey && event.key === 's') {
      event.preventDefault();
      onSave();
    }
    // Ctrl+F: Format
    else if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      handleFormat();
    }
    // Ctrl+K: Clear
    else if (event.ctrlKey && event.key === 'k') {
      event.preventDefault();
      onChange('');
    }
    // Ctrl+?: Show shortcuts
    else if (event.ctrlKey && event.key === '?') {
      event.preventDefault();
      setShortcutsOpen(true);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value]);

  const isValid = parseResult.sql && parseResult.errors.length === 0;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20 py-[9px]">
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
          <Button 
            onClick={handleFormat}
            size="sm"
            variant="outline"
            disabled={!value}
            title="Format SQL (Ctrl+F)"
          >
            <Wand2 className="h-4 w-4" />
          </Button>
          
          <Button onClick={handleCopy} variant="outline" size="sm" className="gap-2" title="Copy to clipboard">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          
          <Button
            onClick={onSave}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!value.trim()}
            title="Save query (Ctrl+S)"
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
          
          <Button 
            onClick={() => setShortcutsOpen(true)}
            size="sm"
            variant="ghost"
            title="Keyboard shortcuts (Ctrl+?)"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
          
          <Button onClick={handleExecute} disabled={!isValid || isExecuting} size="sm" className="gap-2">
            {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Execute
          </Button>
        </div>
      </div>

      {/* Resizable Panels for Editor and Bottom Content */}
      <ResizablePanelGroup direction="vertical" className="flex-1">
        {/* Editor Panel */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <div className="h-full overflow-hidden border border-border rounded-md m-4">
            <CodeMirror 
              value={value} 
              height="100%" 
              extensions={[sql(), EditorView.lineWrapping]} 
              onChange={val => onChange(val)}
              onCreateEditor={(view) => {
                editorViewRef.current = view;
              }}
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
                overflow: 'auto'
              }}
            />
          </div>
        </ResizablePanel>

        {/* Resizable Handle */}
        <ResizableHandle withHandle />

        {/* Bottom Content Panel */}
        <ResizablePanel defaultSize={40} minSize={20}>
          <div className="h-full overflow-y-auto flex flex-col">
            {/* Help Text */}
            <div className="p-3 border-t border-border bg-muted/10 text-xs text-muted-foreground">
              Press <kbd>Ctrl+Enter</kbd> (or <kbd>Cmd+Enter</kbd> on Mac) to execute • SELECT and UPDATE FORM statements allowed
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
                  {parseResult.sql.startsWith('UPDATE::BATCH::') ? 'UPDATE query validated (bulk update ready)' : parseResult.sql}
                </pre>
              </div>
            )}

            {/* Example Queries */}
            <Collapsible open={examplesOpen} onOpenChange={setExamplesOpen}>
              <div className="border-t border-border bg-muted/10">
                <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
                  <h4 className="text-sm font-medium text-muted-foreground">Example Queries</h4>
                  {examplesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3 pt-0 space-y-1 text-xs text-muted-foreground font-mono max-h-[400px] overflow-y-auto">
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
                    <div>SELECT IFNULL(FIELD("middle-name"), 'N/A') AS middle FROM "form-uuid"</div>
                    <div>SELECT CASE WHEN FIELD("score") &gt;= 90 THEN 'A' WHEN FIELD("score") &gt;= 80 THEN 'B' WHEN FIELD("score") &gt;= 70 THEN 'C' ELSE 'F' END AS grade FROM "form-uuid"</div>
                    
                    <div className="font-semibold mt-2">Advanced WHERE Operators:</div>
                    <div>SELECT * FROM "form-uuid" WHERE FIELD("status") IN ('active', 'pending', 'approved')</div>
                    <div>SELECT * FROM "form-uuid" WHERE FIELD("age") BETWEEN 18 AND 65</div>
                    <div>SELECT * FROM "form-uuid" WHERE FIELD("email") IS NOT NULL</div>
                    <div>SELECT * FROM "form-uuid" WHERE FIELD("deleted-at") IS NULL</div>
                    <div>SELECT * FROM "form-uuid" WHERE FIELD("name") LIKE '%John%'</div>
                    <div>SELECT * FROM "form-uuid" WHERE FIELD("category") NOT IN ('archived', 'deleted')</div>
                    <div>SELECT * FROM "form-uuid" WHERE NOT (FIELD("status") = 'inactive')</div>
                    <div>SELECT * FROM "form-uuid" WHERE FIELD("name") NOT LIKE '%test%'</div>
                    
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
                    
                    <div className="font-semibold mt-2">UPDATE with Arithmetic:</div>
                    <div>UPDATE FORM "form-uuid" SET FIELD("price") = FIELD("price") * 1.1 WHERE FIELD("category") = 'premium'</div>
                    <div>UPDATE FORM "form-uuid" SET FIELD("quantity") = FIELD("quantity") + 10 WHERE FIELD("stock-low") = 'true'</div>
                    <div>UPDATE FORM "form-uuid" SET FIELD("discount") = FIELD("price") * 0.2 WHERE FIELD("member") = 'vip'</div>
                    
                    <div className="font-semibold mt-2">UPDATE with CASE WHEN:</div>
                    <div>UPDATE FORM "form-uuid" SET FIELD("grade") = CASE WHEN FIELD("score") &gt;= 90 THEN 'A' WHEN FIELD("score") &gt;= 80 THEN 'B' ELSE 'C' END WHERE submission_id = "uuid"</div>
                    <div>UPDATE FORM "form-uuid" SET FIELD("status") = CASE WHEN FIELD("paid") = 'true' THEN 'active' ELSE 'inactive' END WHERE FIELD("user-type") = 'customer'</div>
                    
                    <div className="font-semibold mt-2">Internal Database Queries - Users:</div>
                    <div>SELECT * FROM user_profiles WHERE organization_id = 'org-uuid'</div>
                    <div>SELECT COUNT(*) FROM user_profiles WHERE organization_id = 'org-uuid'</div>
                    <div>SELECT id, email, first_name, last_name, role FROM user_profiles WHERE id = 'user-uuid'</div>
                    <div>SELECT * FROM user_profiles WHERE role = 'admin' AND organization_id = 'org-uuid'</div>
                    
                    <div className="font-semibold mt-2">Internal Database Queries - Projects:</div>
                    <div>SELECT * FROM projects WHERE organization_id = 'org-uuid'</div>
                    <div>SELECT COUNT(*) FROM projects WHERE organization_id = 'org-uuid'</div>
                    <div>SELECT name, description, status, created_at FROM projects WHERE id = 'project-uuid'</div>
                    <div>SELECT * FROM projects WHERE created_by = 'user-uuid'</div>
                    
                    <div className="font-semibold mt-2">Internal Database Queries - Forms:</div>
                    <div>SELECT * FROM forms WHERE organization_id = 'org-uuid'</div>
                    <div>SELECT COUNT(*) FROM forms WHERE organization_id = 'org-uuid'</div>
                    <div>SELECT * FROM forms WHERE project_id = 'project-uuid'</div>
                    <div>SELECT name, status, reference_id FROM forms WHERE id = 'form-uuid'</div>
                    <div>SELECT COUNT(*) FROM forms WHERE project_id = 'project-uuid' AND status = 'published'</div>
                    
                    <div className="font-semibold mt-2">Internal Database Queries - Form Fields:</div>
                    <div>SELECT * FROM form_fields WHERE form_id = 'form-uuid'</div>
                    <div>SELECT COUNT(*) FROM form_fields WHERE form_id = 'form-uuid'</div>
                    <div>SELECT label, field_type, required FROM form_fields WHERE form_id = 'form-uuid' ORDER BY field_order</div>
                    <div>SELECT * FROM form_fields WHERE form_id = 'form-uuid' AND is_enabled = true</div>
                    
                    <div className="font-semibold mt-2">Internal Database Queries - Submissions:</div>
                    <div>SELECT * FROM form_submissions WHERE form_id = 'form-uuid'</div>
                    <div>SELECT COUNT(*) FROM form_submissions WHERE form_id = 'form-uuid'</div>
                    <div>SELECT submission_ref_id, submitted_at, submitted_by, submission_data FROM form_submissions WHERE form_id = 'form-uuid'</div>
                    <div>SELECT * FROM form_submissions WHERE approval_status = 'pending'</div>
                    
                    <div className="font-semibold mt-2">Internal Database Queries - Workflows:</div>
                    <div>SELECT * FROM workflows WHERE organization_id = 'org-uuid'</div>
                    <div>SELECT COUNT(*) FROM workflows WHERE organization_id = 'org-uuid'</div>
                    <div>SELECT name, status, trigger_type FROM workflows WHERE project_id = 'project-uuid'</div>
                    
                    <div className="font-semibold mt-2">Internal Database Queries - Reports:</div>
                    <div>SELECT * FROM reports WHERE organization_id = 'org-uuid'</div>
                    <div>SELECT COUNT(*) FROM reports WHERE organization_id = 'org-uuid'</div>
                    <div>SELECT name, description, created_at FROM reports WHERE project_id = 'project-uuid'</div>
                    
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      
      <KeyboardShortcutsDialog 
        open={shortcutsOpen} 
        onOpenChange={setShortcutsOpen} 
      />
    </div>
  );
});
