import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calculator, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CalculatedFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
  formData?: Record<string, any>;
}

export function CalculatedField({ 
  field, 
  value, 
  onChange, 
  error, 
  disabled,
  formData = {}
}: CalculatedFieldProps) {
  const [calculatedValue, setCalculatedValue] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);
  const config = (field.customConfig as any) || {};

  useEffect(() => {
    if (config.calculateOn === 'load' || config.calculateOn === 'change') {
      calculateValue();
    }
  }, [formData, config.formula, config.targetFormId]);

  const calculateValue = async () => {
    if (!config.formula || !config.targetFormId) {
      setCalculatedValue('');
      return;
    }

    setIsCalculating(true);
    try {
      const result = await performCalculation();
      const formattedResult = formatResult(result);
      setCalculatedValue(formattedResult);
      
      if (onChange) {
        onChange(formattedResult);
      }
    } catch (error) {
      console.error('Calculation error:', error);
      setCalculatedValue('Error');
    } finally {
      setIsCalculating(false);
    }
  };

  const performCalculation = async (): Promise<number> => {
    const formula = config.formula.toLowerCase();
    
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
      
      // Simple field extraction (in a real implementation, use proper formula parsing)
      Object.keys(data).forEach(fieldId => {
        if (formula.includes(fieldId.toLowerCase())) {
          const value = parseFloat(data[fieldId]);
          if (!isNaN(value)) {
            fieldValues.push(value);
          }
        }
      });
    });

    // Perform calculation based on formula
    if (formula.includes('sum(')) {
      return fieldValues.reduce((sum, val) => sum + val, 0);
    } else if (formula.includes('avg(')) {
      return fieldValues.length > 0 ? fieldValues.reduce((sum, val) => sum + val, 0) / fieldValues.length : 0;
    } else if (formula.includes('count(')) {
      return fieldValues.length;
    } else if (formula.includes('min(')) {
      return fieldValues.length > 0 ? Math.min(...fieldValues) : 0;
    } else if (formula.includes('max(')) {
      return fieldValues.length > 0 ? Math.max(...fieldValues) : 0;
    }

    // For simple math expressions, try to evaluate safely
    try {
      // Very basic expression evaluation (in production, use a proper math parser)
      let expression = formula;
      Object.keys(formData).forEach(fieldId => {
        const value = parseFloat(formData[fieldId]) || 0;
        expression = expression.replace(new RegExp(fieldId, 'g'), value.toString());
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

      {config.showFormula && config.formula && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
          <p className="text-blue-800">
            <strong>Formula:</strong> {config.formula}
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