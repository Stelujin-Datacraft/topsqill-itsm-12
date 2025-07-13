import React, { useState, useEffect, useRef } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calculator, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { extractFieldIdsFromExpression, replaceFieldReferencesInExpression, ParsedFieldReference } from '@/utils/fieldReferenceParser';
import { CalculationEngine } from '@/utils/calculationEngine';

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
      // For current submission scope, skip backend call and use frontend calculation directly
      if (config.calculationScope === 'current') {
        console.log('Using frontend calculation for current submission scope');
        const result = await performCalculation();
        const formattedResult = formatResult(result);
        setCalculatedValue(formattedResult);
        setLastCalculatedAt(new Date());
        
        if (onChange) {
          onChange(formattedResult);
        }
      } else {
        // Try backend calculation first for other scopes
        try {
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
        } catch (backendError) {
          console.log('Backend calculation failed, using frontend fallback:', backendError);
          // Fallback to frontend calculation
          const result = await performCalculation();
          const formattedResult = formatResult(result);
          setCalculatedValue(formattedResult);
          setLastCalculatedAt(new Date());
          
          if (onChange) {
            onChange(formattedResult);
          }
        }
      }
    } catch (error) {
      console.error('Calculation error:', error);
      setCalculatedValue('Error');
      setLastCalculatedAt(new Date());
    } finally {
      setIsCalculating(false);
    }
  };

  const handleManualCalculate = () => {
    calculateValue();
  };

  const performCalculation = async (): Promise<number> => {
    console.log('Starting calculation with formula:', config.formula);
    console.log('Available form data:', formData);

    try {
      // Get data based on scope for context
      let allSubmissions: any[] = [];
      
      switch (config.calculationScope) {
        case 'current':
          console.log('Using current form data for calculation');
          allSubmissions = [{ submission_data: formData }];
          break;
        case 'all':
          allSubmissions = await getAllSubmissions();
          break;
        case 'user':
          allSubmissions = await getUserSubmissions();
          break;
      }

      // Prepare calculation context with form data and all submissions
      const calculationContext = {
        formData: formData,
        allSubmissions: allSubmissions
      };

      // Create calculation engine with context
      const engine = new CalculationEngine(calculationContext);
      
      // Preprocess the formula to replace field references with proper format
      let processedFormula = config.formula;
      
      // Replace our new format (form_ref.field_ref.XXXXXX) with #field_id format for the engine
      const pattern = /(\w+)\.(\w+)\.([a-f0-9]{6})/g;
      let match;
      const matches = [];
      
      while ((match = pattern.exec(config.formula)) !== null) {
        matches.push({
          fullMatch: match[0],
          last6Chars: match[3]
        });
      }
      
      // Replace each match with the actual field ID
      matches.forEach(({ fullMatch, last6Chars }) => {
        const matchingFieldId = Object.keys(formData).find(fieldId => 
          fieldId.replace(/-/g, '').slice(-6) === last6Chars
        );
        
        if (matchingFieldId) {
          processedFormula = processedFormula.replace(fullMatch, `#${matchingFieldId}`);
          console.log(`Replaced ${fullMatch} with #${matchingFieldId}`);
        }
      });

      console.log('Processed formula for calculation engine:', processedFormula);
      
      // Use the calculation engine to evaluate the expression
      const result = await engine.evaluate(processedFormula);
      console.log('Calculation engine result:', result);
      
      // Return the result as a number
      if (typeof result === 'number') {
        return result;
      } else if (typeof result === 'string' && !isNaN(parseFloat(result))) {
        return parseFloat(result);
      } else {
        console.log('Result is not a number, returning 0');
        return 0;
      }
      
    } catch (error) {
      console.error('Calculation engine error:', error);
      
      // Fallback to basic calculation for simple expressions
      return await performBasicCalculation();
    }
  };

  // Fallback basic calculation method
  const performBasicCalculation = async (): Promise<number> => {
    console.log('Using fallback basic calculation');
    
    // Extract field IDs manually for the new format
    const fieldIds = extractFieldIdsManually(config.formula);
    console.log('Extracted field IDs:', fieldIds);
    
    // Get field values
    const fieldValues: number[] = [];
    fieldIds.forEach(fieldId => {
      const value = parseFloat(formData[fieldId]);
      if (!isNaN(value)) {
        fieldValues.push(value);
      }
    });
    
    console.log('Field values for basic calculation:', fieldValues);
    
    // Try to evaluate simple expressions
    try {
      let expression = config.formula;
      
      // Replace field references with values
      fieldIds.forEach(fieldId => {
        const value = parseFloat(formData[fieldId]) || 0;
        const last6Chars = fieldId.replace(/-/g, '').slice(-6);
        const newFormatRegex = new RegExp(`\\w+\\.\\w+\\.${last6Chars}`, 'g');
        expression = expression.replace(newFormatRegex, value.toString());
      });
      
      console.log('Basic calculation expression:', expression);
      
      // Only allow basic math operations for security
      if (/^[0-9+\-*/().\s]+$/.test(expression)) {
        const result = Function(`"use strict"; return (${expression})`)();
        return result;
      }
    } catch (error) {
      console.error('Basic calculation error:', error);
    }
    
    // If all else fails, return first field value or 0
    return fieldValues.length > 0 ? fieldValues[0] : 0;
  };

  // Manual field ID extraction for the new format: form_ref.field_ref.XXXXXX
  const extractFieldIdsManually = (formula: string): string[] => {
    const fieldIds: string[] = [];
    
    // Pattern: form_ref.field_ref.XXXXXX where XXXXXX are last 6 chars of field ID (no hyphens)
    const pattern = /\w+\.\w+\.([a-f0-9]{6})/g;
    let match;
    
    while ((match = pattern.exec(formula)) !== null) {
      const last6Chars = match[1];
      
      // Find matching field ID from form data
      const matchingFieldId = Object.keys(formData).find(fieldId => 
        fieldId.replace(/-/g, '').slice(-6) === last6Chars
      );
      
      if (matchingFieldId) {
        fieldIds.push(matchingFieldId);
      }
    }
    
    return fieldIds;
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
