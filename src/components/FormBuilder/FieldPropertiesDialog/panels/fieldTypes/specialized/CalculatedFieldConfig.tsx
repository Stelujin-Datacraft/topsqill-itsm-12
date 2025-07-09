import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFormsData } from '@/hooks/useFormsData';
import { useCurrentFormFields } from '@/hooks/useCurrentFormFields';
import { HelpDialog, HelpSection, HelpExample, HelpBadge } from '@/components/ui/help-dialog';
import { CALCULATION_FUNCTIONS, validateExpression, getAutoSuggestions } from '@/utils/calculationEngine';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CalculatedFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors?: Record<string, string>;
}

export function CalculatedFieldConfig({ config, onUpdate, errors }: CalculatedFieldConfigProps) {
  const customConfig = config.customConfig || {};
  const { forms } = useFormsData();
  const { formFieldOptions } = useCurrentFormFields();
  const [expressionErrors, setExpressionErrors] = useState<string[]>([]);
  const [showFunctionHelp, setShowFunctionHelp] = useState(false);

  const handleConfigChange = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value
      }
    });
    
    // Validate expression when formula changes
    if (key === 'formula') {
      const availableFields = formFieldOptions.map(f => f.value);
      const validation = validateExpression(value, availableFields);
      setExpressionErrors(validation.errors);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Calculated Field Configuration</h3>
        
        <div className="space-y-2">
          <Label htmlFor="targetForm">Source Form</Label>
          <Select
            value={customConfig.targetFormId || ''}
            onValueChange={(value) => handleConfigChange('targetFormId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select source form" />
            </SelectTrigger>
            <SelectContent>
              {forms.map((form) => (
                <SelectItem key={form.id} value={form.id}>
                  {form.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            The form from which to calculate values
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="calculationScope">Calculation Scope</Label>
          <Select
            value={customConfig.calculationScope || 'current'}
            onValueChange={(value) => handleConfigChange('calculationScope', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select calculation scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current submission only</SelectItem>
              <SelectItem value="all">All submissions</SelectItem>
              <SelectItem value="user">Current user's submissions</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="formula">Formula Expression</Label>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setShowFunctionHelp(!showFunctionHelp)}
              >
                {showFunctionHelp ? 'Hide' : 'Show'} Functions
              </Button>
            </div>
          </div>
          
          <Textarea
            id="formula"
            value={customConfig.formula || ''}
            onChange={(e) => handleConfigChange('formula', e.target.value)}
            placeholder="ADD(#field1, #field2) or SUM(#field_id) or IF(#status = 'urgent', 1, 0)"
            rows={4}
            className={expressionErrors.length > 0 ? 'border-red-500' : ''}
          />
          
          {expressionErrors.length > 0 && (
            <div className="space-y-1">
              {expressionErrors.map((error, index) => (
                <p key={index} className="text-sm text-red-500">{error}</p>
              ))}
            </div>
          )}
          
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Reference fields using #field_id (e.g., #price, #quantity)</p>
            <p>• Use functions like ADD(), SUM(), IF(), etc.</p>
            <p>• Aggregate functions work across all submissions</p>
          </div>

          {showFunctionHelp && (
            <div className="border rounded-lg p-4 bg-muted/30 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                {Object.entries(
                  CALCULATION_FUNCTIONS.reduce((acc, func) => {
                    if (!acc[func.category]) acc[func.category] = [];
                    acc[func.category].push(func);
                    return acc;
                  }, {} as Record<string, typeof CALCULATION_FUNCTIONS>)
                ).map(([category, functions]) => (
                  <div key={category}>
                    <h4 className="font-medium text-sm mb-2">{category}</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {functions.map((func) => (
                        <div key={func.name} className="text-xs">
                          <Badge variant="outline" className="mr-2">{func.syntax}</Badge>
                          <span className="text-muted-foreground">{func.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-xs font-medium">Available Fields:</p>
            <div className="flex flex-wrap gap-1">
              {formFieldOptions.slice(0, 10).map((field) => (
                <Badge key={field.value} variant="secondary" className="text-xs">
                  #{field.value}
                </Badge>
              ))}
              {formFieldOptions.length > 10 && (
                <Badge variant="secondary" className="text-xs">
                  +{formFieldOptions.length - 10} more
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="calculateOn">Calculate On</Label>
          <Select
            value={customConfig.calculateOn || 'change'}
            onValueChange={(value) => handleConfigChange('calculateOn', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select when to calculate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="change">Field change</SelectItem>
              <SelectItem value="submit">Form submit</SelectItem>
              <SelectItem value="load">Form load</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="decimalPlaces">Decimal Places</Label>
          <Input
            id="decimalPlaces"
            type="number"
            min="0"
            max="10"
            value={customConfig.decimalPlaces || 2}
            onChange={(e) => handleConfigChange('decimalPlaces', parseInt(e.target.value) || 2)}
            placeholder="2"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prefix">Prefix</Label>
          <Input
            id="prefix"
            value={customConfig.prefix || ''}
            onChange={(e) => handleConfigChange('prefix', e.target.value)}
            placeholder="$"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="suffix">Suffix</Label>
          <Input
            id="suffix"
            value={customConfig.suffix || ''}
            onChange={(e) => handleConfigChange('suffix', e.target.value)}
            placeholder="%"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showFormula"
            checked={customConfig.showFormula || false}
            onCheckedChange={(checked) => handleConfigChange('showFormula', checked)}
          />
          <Label htmlFor="showFormula">Show formula to users</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="autoCompute"
            checked={customConfig.autoCompute !== false}
            onCheckedChange={(checked) => handleConfigChange('autoCompute', checked)}
          />
          <Label htmlFor="autoCompute">Auto-compute on data change</Label>
        </div>
      </div>
    </div>
  );
}