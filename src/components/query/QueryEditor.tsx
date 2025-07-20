
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseUserQuery, ParseError } from '@/services/sqlParser';
import { schemaCache } from '@/services/schemaCache';
import { Loader2, Play } from 'lucide-react';

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
  onChange 
}) => {
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [lineCount, setLineCount] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

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
      validateQuery(value);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [value, validateQuery]);

  useEffect(() => {
    const lines = value.split('\n').length;
    setLineCount(lines);
    
    // Sync scroll between textarea and line numbers
    if (textareaRef.current && lineNumbersRef.current) {
      const syncScroll = () => {
        if (textareaRef.current && lineNumbersRef.current) {
          lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
        }
      };
      
      textareaRef.current.addEventListener('scroll', syncScroll);
      return () => textareaRef.current?.removeEventListener('scroll', syncScroll);
    }
  }, [value]);

  const handleExecute = async () => {
    if (!isValid || isExecuting) return;
    
    try {
      const cache = await schemaCache.getCache();
      const result = parseUserQuery(value, cache);
      
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
    
    // Handle tab indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      
      // Reset cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const renderLineNumbers = () => {
    return Array.from({ length: lineCount }, (_, i) => (
      <div key={i + 1} className="text-muted-foreground text-right pr-2 leading-6">
        {i + 1}
      </div>
    ));
  };

  const highlightSyntax = (text: string) => {
    // Simple syntax highlighting
    return text
      .replace(/\b(SELECT|FROM|WHERE|AND|OR|COUNT|SUM|AVG|MIN|MAX)\b/gi, '<span class="text-blue-600 font-medium">$1</span>')
      .replace(/"[^"]*"/g, '<span class="text-green-600">$&</span>')
      .replace(/'[^']*'/g, '<span class="text-amber-600">$&</span>')
      .replace(/\b(\d+)\b/g, '<span class="text-purple-600">$1</span>')
      .replace(/([><=!]+)/g, '<span class="text-red-600">$1</span>');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">SQL Query</h3>
          {isValidating && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 relative">
          <div className="absolute inset-0 flex">
            {/* Line Numbers */}
            <div 
              ref={lineNumbersRef}
              className="w-12 bg-muted/30 border-r border-border p-2 text-xs font-mono overflow-hidden"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {renderLineNumbers()}
            </div>
            
            {/* Editor Area */}
            <div className="flex-1 relative">
              {/* Syntax Highlighting Background */}
              <div 
                className="absolute inset-0 p-3 text-xs font-mono leading-6 pointer-events-none whitespace-pre-wrap break-words overflow-hidden"
                style={{ 
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                  color: 'transparent'
                }}
                dangerouslySetInnerHTML={{ __html: highlightSyntax(value) }}
              />
              
              {/* Actual Textarea */}
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='SELECT "field-id" FROM "form-id" WHERE...'
                className="absolute inset-0 w-full h-full p-3 bg-transparent border-none outline-none resize-none text-xs font-mono leading-6 text-foreground caret-foreground"
                style={{ 
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                }}
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="p-3 border-t border-border bg-muted/10">
          <div className="text-xs text-muted-foreground">
            Press Ctrl+Enter (Cmd+Enter on Mac) to execute • Only SELECT statements allowed
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="p-3 border-t border-border space-y-2">
            {errors.map((error, index) => (
              <Alert key={index} variant="destructive">
                <AlertDescription className="text-sm">
                  <span className="font-medium">
                    {error.type === 'syntax' ? 'Syntax Error' : 
                     error.type === 'unknown_field' ? 'Unknown Field' : 
                     error.type === 'unknown_form' ? 'Unknown Form' : 'Error'}:
                  </span> {error.message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Example Queries */}
        <div className="p-3 border-t border-border bg-muted/10">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Example Queries:</h4>
          <div className="space-y-1 text-xs text-muted-foreground font-mono">
            <div>SELECT "field-uuid" FROM "form-uuid";</div>
            <div>SELECT COUNT(*) FROM "form-uuid" WHERE "status" = 'approved';</div>
            <div>SELECT SUM("amount") FROM "form-uuid" WHERE submitted_at &gt; '2025-01-01';</div>
            <div>SELECT submission_id, "rating" FROM "form-uuid" WHERE "rating" &gt;= 4;</div>
          </div>
        </div>
      </div>
    </div>
  );
};
