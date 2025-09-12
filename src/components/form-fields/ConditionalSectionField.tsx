import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';

interface ConditionalSectionFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
  formData?: Record<string, any>;
}

export function ConditionalSectionField({ 
  field, 
  value, 
  onChange, 
  error, 
  disabled,
  formData = {}
}: ConditionalSectionFieldProps) {
  const [conditionsMatch, setConditionsMatch] = useState(false);
  const [displayValue, setDisplayValue] = useState('');
  const config = (field.customConfig as any) || {};

  useEffect(() => {
    const match = evaluateConditions();
    setConditionsMatch(match);
    
    const newValue = match ? config.trueValue || '' : config.falseValue || '';
    setDisplayValue(newValue);
    
    if (onChange) {
      onChange(newValue);
    }
  }, [formData, config.conditions, config.logic, config.trueValue, config.falseValue]);

  const evaluateConditions = (): boolean => {
    const conditions = config.conditions || [];
    if (conditions.length === 0) return false;

    const results = conditions.map((condition: any) => {
      const fieldValue = formData[condition.field];
      const conditionValue = condition.value;

      switch (condition.operator) {
        case '==':
          return fieldValue == conditionValue;
        case '!=':
          return fieldValue != conditionValue;
        case '>':
          return Number(fieldValue) > Number(conditionValue);
        case '<':
          return Number(fieldValue) < Number(conditionValue);
        case '>=':
          return Number(fieldValue) >= Number(conditionValue);
        case '<=':
          return Number(fieldValue) <= Number(conditionValue);
        case 'contains':
          return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
        case 'isEmpty':
          return !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
        case 'isNotEmpty':
          return fieldValue && fieldValue !== '' && (!Array.isArray(fieldValue) || fieldValue.length > 0);
        default:
          return false;
      }
    });

    // Apply logic
    if (config.logic === 'OR') {
      return results.some(result => result);
    } else {
      return results.every(result => result);
    }
  };

  const getConditionSummary = () => {
    const conditions = config.conditions || [];
    if (conditions.length === 0) return 'No conditions configured';

    const summaryParts = conditions.map((condition: any, index: number) => {
      const connector = index === 0 ? '' : ` ${config.logic || 'AND'} `;
      return `${connector}${condition.field} ${condition.operator} "${condition.value}"`;
    });

    return summaryParts.join('');
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>
        <div className="flex items-center space-x-2">
          {conditionsMatch ? (
            <Eye className="h-4 w-4 text-green-600" />
          ) : (
            <EyeOff className="h-4 w-4 text-gray-400" />
          )}
          <span>{field.label}</span>
        </div>
      </Label>
      
      <Input
        id={field.id}
        value={displayValue}
        disabled={true}
        className={`${conditionsMatch ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
        placeholder="Value based on conditions"
      />

      <div className="space-y-2 p-3 bg-gray-50 border rounded text-sm">
        <div className="flex items-center space-x-2">
          <span className="font-medium">Status:</span>
          <span className={conditionsMatch ? 'text-green-600' : 'text-gray-600'}>
            {conditionsMatch ? 'Conditions Met' : 'Conditions Not Met'}
          </span>
        </div>
        
        <div>
          <span className="font-medium">Conditions:</span>
          <p className="text-gray-600 mt-1 font-mono text-xs">
            {getConditionSummary()}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <span className="font-medium text-green-700">If True:</span>
            <p className="text-green-600">{config.trueValue || '(empty)'}</p>
          </div>
          <div>
            <span className="font-medium text-red-700">If False:</span>
            <p className="text-red-600">{config.falseValue || '(empty)'}</p>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}