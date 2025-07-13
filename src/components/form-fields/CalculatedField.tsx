import React, { useState, useEffect, useRef } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calculator, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { extractFieldIdsFromExpression, replaceFieldReferencesInExpression, ParsedFieldReference } from '@/utils/fieldReferenceParser';

interface CalculatedFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
  formData?: Record<string, any>;
  allFormFields?: ParsedFieldReference[];
}

export function CalculatedField({ 
  field, 
  value, 
  onChange, 
  error, 
  disabled,
  formData = {},
  allFormFields = []
}: CalculatedFieldProps) {
  const [calculatedValue, setCalculatedValue] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastCalculatedAt, setLastCalculatedAt] = useState<Date | null>(null);
  const config = (field.customConfig as any) || {};
  const previousFormDataRef = useRef<Record<string, any>>({});

  // Get field IDs that this calculation depends on
  const dependentFieldIds = extractFieldIdsFromExpression(config.formula || '', allFormFields);

  useEffect(() => {
    if (config.calculateOn === 'load') {
      calculateValue();
    }
  }, [config.formula, config.targetFormId]);

  // Monitor specific field changes for calculations
  useEffect(() => {
    if (config.calculateOn === 'change' && dependentFieldIds.length > 0) {
      const hasRelevantChanges = dependentFieldIds.some(fieldId => {
        const prevValue = previousFormDataRef.current[fieldId];
        const currentValue = formData[fieldId];
        return prevValue !== currentValue;
      });
      
      if (hasRelevantChanges && Object.keys(previousFormDataRef.current).length > 0) {
        calculateValue();
      }
    }
    
    previousFormDataRef.current = { ...formData };
  }, [formData, dependentFieldIds, config.calculateOn]);

  const calculateValue = async () => {
    if (!config.formula || !config.targetFormId) {
      setCalculatedValue('');
      return;
    }

    setIsCalculating(true);
    try {
      // Call backend calculation API
      const { data, error } = await supabase.functions.invoke('calculate-field', {
        body: {
          formula: config.formula,
          targetFormId: config.targetFormId,
          calculationScope: config.calculationScope,
          formData: formData,
          allFormFields: allFormFields
        }
      });

      if (error) throw error;
      
      const formattedResult = formatResult(data.result || 0);
      setCalculatedValue(formattedResult);
      setLastCalculatedAt(new Date());
      
      if (onChange) {
        onChange(formattedResult);
      }
    } catch (error) {
      console.error('Calculation error:', error);
      // Fallback to frontend calculation
      try {
        const result = await performCalculation();
        const formattedResult = formatResult(result);
        setCalculatedValue(formattedResult);
        setLastCalculatedAt(new Date());
        
        if (onChange) {
          onChange(formattedResult);
        }
      } catch (fallbackError) {
        console.error('Fallback calculation error:', fallbackError);
        setCalculatedValue('Error');
        setLastCalculatedAt(new Date());
      }
    } finally {
      setIsCalculating(false);
    }
  };

  const handleManualCalculate = () => {
    calculateValue();
  };

  const performCalculation = async (): Promise<number> => {
    // Replace field references with actual field IDs
    const processedFormula = replaceFieldReferencesInExpression(config.formula, allFormFields);
    
    // Get data based on scope
    let submissions: any[] = [];
    
    switch (config.calculationScope) {
      case 'current':
        // Use current form data
        submissions = [{ submission_data: formData }];
        break;
      case 'all':
        submissions = await getAllSubmissions();
        break;
      case 'user':
        submissions = await getUserSubmissions();
        break;
    }

    // Extract field values based on formula
    const fieldValues: number[] = [];
    
    submissions.forEach(submission => {
      const data = submission.submission_data || submission;
      
      // Extract field IDs from processed formula
      const referencedFieldIds = dependentFieldIds;
      
      referencedFieldIds.forEach(fieldId => {
        const value = parseFloat(data[fieldId]);
        if (!isNaN(value)) {
          fieldValues.push(value);
        }
      });
    });

    // Perform calculation based on formula
    const lowerFormula = processedFormula.toLowerCase();
    if (lowerFormula.includes('sum(')) {
      return fieldValues.reduce((sum, val) => sum + val, 0);
    } else if (lowerFormula.includes('avg(')) {
      return fieldValues.length > 0 ? fieldValues.reduce((sum, val) => sum + val, 0) / fieldValues.length : 0;
    } else if (lowerFormula.includes('count(')) {
      return fieldValues.length;
    } else if (lowerFormula.includes('min(')) {
      return fieldValues.length > 0 ? Math.min(...fieldValues) : 0;
    } else if (lowerFormula.includes('max(')) {
      return fieldValues.length > 0 ? Math.max(...fieldValues) : 0;
    }

    // For simple math expressions, try to evaluate safely
    try {
      let expression = processedFormula;
      
      // Replace field references with actual values
      dependentFieldIds.forEach(fieldId => {
        const value = parseFloat(formData[fieldId]) || 0;
        expression = expression.replace(new RegExp(`#${fieldId}`, 'g'), value.toString());
      });
      
      // Only allow basic math operations for security
      if (/^[0-9+\-*/().\s]+$/.test(expression)) {
        return Function(`"use strict"; return (${expression})`)();
      }
    } catch (error) {
      console.error('Expression evaluation error:', error);
    }

    return 0;
  };

  const getAllSubmissions = async () => {
    const { data, error } = await supabase
      .from('form_submissions')
      .select('submission_data')
      .eq('form_id', config.targetFormId);
    
    if (error) throw error;
    return data || [];
  };

  const getUserSubmissions = async () => {
    const { data, error } = await supabase
      .from('form_submissions')
      .select('submission_data')
      .eq('form_id', config.targetFormId)
      .eq('submitted_by', 'current_user'); // In real implementation, use actual user ID
    
    if (error) throw error;
    return data || [];
  };

  const formatResult = (result: number): string => {
    const decimals = config.decimalPlaces ?? 2;
    const formatted = result.toFixed(decimals);
    const prefix = config.prefix || '';
    const suffix = config.suffix || '';
    
    return `${prefix}${formatted}${suffix}`;
  };

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>
        <div className="flex items-center space-x-2">
          <Calculator className="h-4 w-4" />
          <span>{field.label}</span>
        </div>
      </Label>
      
      <div className="relative">
        <Input
          id={field.id}
          value={calculatedValue}
          disabled={true}
          className="bg-gray-50 border-gray-200"
          placeholder={isCalculating ? "Calculating..." : "Calculated value will appear here"}
        />
        
        {isCalculating && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleManualCalculate}
          disabled={isCalculating || !config.formula}
          className="flex items-center space-x-2"
        >
          <RefreshCw className={`h-3 w-3 ${isCalculating ? 'animate-spin' : ''}`} />
          <span>Re-calculate</span>
        </Button>
        
        {lastCalculatedAt && (
          <div className="text-xs text-muted-foreground">
            Last calculated: {formatTimestamp(lastCalculatedAt)}
          </div>
        )}
      </div>

      {config.showFormula && config.formula && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
          <p className="text-blue-800">
            <strong>Formula:</strong> 
            <span className="break-words ml-1 font-mono text-xs">{config.formula}</span>
          </p>
        </div>
      )}

      {config.calculationScope && (
        <p className="text-xs text-gray-500">
          Scope: {config.calculationScope === 'current' ? 'Current submission' : 
                  config.calculationScope === 'all' ? 'All submissions' : 'User submissions'}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
