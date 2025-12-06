import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { ExpressionEvaluator } from '@/utils/expressionEvaluator';
import { cn } from '@/lib/utils';

interface LogicalExpressionInputProps {
  value: string;
  onChange: (expression: string) => void;
  conditionCount: number;
  conditionLabels?: string[];
}

export function LogicalExpressionInput({ 
  value, 
  onChange, 
  conditionCount,
  conditionLabels = []
}: LogicalExpressionInputProps) {
  const [localValue, setLocalValue] = useState(value || '');
  const [isFocused, setIsFocused] = useState(false);

  // Sync with external value
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value || '');
    }
  }, [value, isFocused]);

  // Validate the expression
  const validation = useMemo(() => {
    if (!localValue.trim()) {
      return { valid: false, error: 'Expression is required' };
    }
    
    const result = ExpressionEvaluator.validate(localValue);
    
    if (result.valid) {
      // Check if all referenced conditions exist
      const referencedIds = ExpressionEvaluator.extractConditionIds(localValue);
      const invalidIds = referencedIds.filter(id => {
        const num = parseInt(id, 10);
        return isNaN(num) || num < 1 || num > conditionCount;
      });
      
      if (invalidIds.length > 0) {
        return { 
          valid: false, 
          error: `Invalid condition reference(s): ${invalidIds.join(', ')}. Valid: 1-${conditionCount}` 
        };
      }
    }
    
    return result;
  }, [localValue, conditionCount]);

  // Generate suggestion based on condition count
  const suggestion = useMemo(() => {
    if (conditionCount === 0) return '';
    if (conditionCount === 1) return '1';
    if (conditionCount === 2) return '1 AND 2';
    if (conditionCount === 3) return '(1 AND 2) OR 3';
    return `(1 AND 2) OR (${conditionCount - 1} AND ${conditionCount})`;
  }, [conditionCount]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (validation.valid) {
      onChange(localValue.toUpperCase().trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && validation.valid) {
      onChange(localValue.toUpperCase().trim());
    }
  };

  const applySuggestion = () => {
    setLocalValue(suggestion);
    onChange(suggestion);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Logical Expression</Label>
        <div className="flex items-center gap-1">
          {validation.valid ? (
            <CheckCircle className="h-3 w-3 text-green-600" />
          ) : (
            <AlertCircle className="h-3 w-3 text-destructive" />
          )}
          <span className={cn(
            "text-xs",
            validation.valid ? "text-green-600" : "text-destructive"
          )}>
            {validation.valid ? 'Valid' : 'Invalid'}
          </span>
        </div>
      </div>

      <Input
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={suggestion || "e.g., (1 AND 2) OR 3"}
        className={cn(
          "font-mono text-sm",
          !validation.valid && localValue && "border-destructive focus-visible:ring-destructive"
        )}
      />

      {!validation.valid && localValue && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {validation.error}
        </p>
      )}

      {/* Condition reference guide */}
      <div className="bg-muted/50 p-2 rounded-md space-y-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Info className="h-3 w-3" />
          <span>Available conditions:</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: conditionCount }, (_, i) => (
            <Badge 
              key={i + 1} 
              variant="secondary" 
              className="text-xs font-mono cursor-pointer hover:bg-primary/20"
              onClick={() => setLocalValue(prev => prev + (prev ? ' ' : '') + (i + 1))}
            >
              {i + 1}{conditionLabels[i] ? `: ${conditionLabels[i]}` : ''}
            </Badge>
          ))}
        </div>
        
        <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border/50">
          <p><strong>Operators:</strong> AND, OR, NOT</p>
          <p><strong>Precedence:</strong> NOT &gt; AND &gt; OR (use parentheses to override)</p>
          {suggestion && (
            <p>
              <strong>Suggestion:</strong>{' '}
              <button
                type="button"
                onClick={applySuggestion}
                className="font-mono text-primary hover:underline"
              >
                {suggestion}
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Visual expression preview */}
      {localValue && validation.valid && (
        <div className="bg-primary/5 border border-primary/20 p-2 rounded-md">
          <p className="text-xs font-medium text-primary mb-1">Expression Preview:</p>
          <code className="text-xs font-mono block">
            {formatExpressionForPreview(localValue, conditionLabels)}
          </code>
        </div>
      )}
    </div>
  );
}

// Helper to format expression with labels for preview
function formatExpressionForPreview(expression: string, labels: string[]): string {
  let formatted = expression.toUpperCase();
  
  // Replace condition numbers with labels if available
  const ids = ExpressionEvaluator.extractConditionIds(expression);
  ids.sort((a, b) => parseInt(b, 10) - parseInt(a, 10)); // Sort descending to replace larger numbers first
  
  for (const id of ids) {
    const num = parseInt(id, 10);
    const label = labels[num - 1];
    if (label) {
      // Use word boundary to avoid partial replacements
      const regex = new RegExp(`\\b${id}\\b`, 'g');
      formatted = formatted.replace(regex, `[${id}: ${label}]`);
    }
  }
  
  return formatted;
}
