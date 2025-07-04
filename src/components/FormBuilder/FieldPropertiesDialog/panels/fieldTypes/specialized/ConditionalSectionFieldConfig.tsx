import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';
import { useCurrentFormFields } from '@/hooks/useCurrentFormFields';

interface ConditionalSectionFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors?: Record<string, string>;
}

export function ConditionalSectionFieldConfig({ config, onUpdate, errors }: ConditionalSectionFieldConfigProps) {
  const customConfig = config.customConfig || {};
  const conditions = customConfig.conditions || [];
  const { formFieldOptions } = useCurrentFormFields();

  const handleConfigChange = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value
      }
    });
  };

  const addCondition = () => {
    const newCondition = {
      id: Date.now().toString(),
      field: '',
      operator: '==',
      value: ''
    };
    handleConfigChange('conditions', [...conditions, newCondition]);
  };

  const updateCondition = (index: number, key: string, value: any) => {
    const updatedConditions = [...conditions];
    updatedConditions[index] = { ...updatedConditions[index], [key]: value };
    handleConfigChange('conditions', updatedConditions);
  };

  const removeCondition = (index: number) => {
    const updatedConditions = conditions.filter((_: any, i: number) => i !== index);
    handleConfigChange('conditions', updatedConditions);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Conditional Section Configuration</h3>
        
        <div className="space-y-2">
          <Label htmlFor="triggerRule">Trigger Logic</Label>
          <Select
            value={customConfig.logic || 'AND'}
            onValueChange={(value) => handleConfigChange('logic', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select logic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">All conditions must be true (AND)</SelectItem>
              <SelectItem value="OR">Any condition must be true (OR)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Conditions</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCondition}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Condition
            </Button>
          </div>

          {conditions.map((condition: any, index: number) => (
            <div key={condition.id} className="flex items-center space-x-2 p-3 border rounded-lg bg-gray-50">
              <Select
                value={condition.field}
                onValueChange={(value) => updateCondition(index, 'field', value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {formFieldOptions.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={condition.operator}
                onValueChange={(value) => updateCondition(index, 'operator', value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="==">Equals</SelectItem>
                  <SelectItem value="!=">Not equals</SelectItem>
                  <SelectItem value=">">Greater than</SelectItem>
                  <SelectItem value="<">Less than</SelectItem>
                  <SelectItem value=">=">Greater or equal</SelectItem>
                  <SelectItem value="<=">Less or equal</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="isEmpty">Is empty</SelectItem>
                  <SelectItem value="isNotEmpty">Is not empty</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Value"
                value={condition.value}
                onChange={(e) => updateCondition(index, 'value', e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeCondition(index)}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {conditions.length === 0 && (
            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
              <p>No conditions configured. Click "Add Condition" to get started.</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="trueValue">Value when conditions are TRUE</Label>
          <Input
            id="trueValue"
            value={customConfig.trueValue || ''}
            onChange={(e) => handleConfigChange('trueValue', e.target.value)}
            placeholder="Value to display when conditions match"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="falseValue">Value when conditions are FALSE</Label>
          <Input
            id="falseValue"
            value={customConfig.falseValue || ''}
            onChange={(e) => handleConfigChange('falseValue', e.target.value)}
            placeholder="Value to display when conditions don't match"
          />
        </div>
      </div>
    </div>
  );
}