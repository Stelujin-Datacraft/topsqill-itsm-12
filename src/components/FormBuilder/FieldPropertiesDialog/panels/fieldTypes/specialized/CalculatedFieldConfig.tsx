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
import { Plus } from 'lucide-react';
import { FieldSelector } from '@/components/form-fields/FieldSelector';
import { ParsedFieldReference, createFieldRef, replaceFieldReferencesInExpression, extractFieldIdsFromExpression } from '@/utils/fieldReferenceParser';

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
  const [showFieldSelector, setShowFieldSelector] = useState(false);

  // Get source form details
  const sourceForm = forms.find(form => form.id === customConfig.targetFormId);
  const currentForm = forms.find(form => form.fields && form.fields.length > 0);
  const sourceFormRefId = sourceForm?.reference_id || createFieldRef(sourceForm?.name || 'current');
  
  // Get fields for the selected source form
  // Helper function to extract clean field reference from label
  const extractFieldRef = (label: string): string => {
    // Extract text before parentheses and clean it
    const cleanLabel = label.split('(')[0].trim();
    return createFieldRef(cleanLabel);
  };

  const availableFields = customConfig.targetFormId && customConfig.targetFormId !== currentForm?.id
    ? (sourceForm?.fields || []).map(field => ({
        ...field,
        field_ref: extractFieldRef(field.label)
      }))
    : formFieldOptions.map(f => ({ 
        id: f.value, 
        label: f.label, 
        field_ref: extractFieldRef(f.label),
        type: 'text' as const,
        position: { x: 0, y: 0 },
        size: { width: 12, height: 1 },
        validationRules: [],
        required: false
      }));

  const handleConfigChange = (key: string, value: any) => {
    const updates: any = { [key]: value };
    
    // When source form changes, adjust configuration appropriately
    if (key === 'targetFormId') {
      const selectedForm = forms.find(form => form.id === value);
      
      // If source form is different from current form, disable current submission scope
      if (value && value !== currentForm?.id) {
        updates.calculationScope = 'all'; // Force to 'all' when using external form
      }
    }
    
    onUpdate({
      customConfig: {
        ...customConfig,
        ...updates
      }
    });
    
    // Validate expression when formula changes
    if (key === 'formula') {
      const fieldIds = availableFields.map(field => field.id);
      const validation = validateExpression(value, fieldIds);
      setExpressionErrors(validation.errors);
    }
  };

  const handleFieldSelect = (fieldId: string, fieldReference: ParsedFieldReference) => {
    // Insert field reference at cursor position in expression
    const textarea = document.getElementById('formula-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentExpression = customConfig.formula || '';
      const newExpression = 
        currentExpression.substring(0, start) + 
        fieldReference.displayText + 
        currentExpression.substring(end);
      
      handleConfigChange('formula', newExpression);
      
      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + fieldReference.displayText.length, start + fieldReference.displayText.length);
      }, 0);
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
            disabled={customConfig.targetFormId && customConfig.targetFormId !== currentForm?.id}
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
          <p className="text-sm text-muted-foreground">
            {customConfig.targetFormId && customConfig.targetFormId !== currentForm?.id
              ? "Cross-form calculations use 'All submissions' scope"
              : "Define the data scope for calculations"
            }
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="formula">Formula Expression</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowFieldSelector(!showFieldSelector)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Field
              </Button>
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
          
          {showFieldSelector && (
            <div className="mb-3">
              <FieldSelector
                fields={availableFields}
                formRefId={sourceFormRefId}
                onSelectField={handleFieldSelect}
                placeholder="Select a field to insert..."
                className="w-full"
              />
            </div>
          )}
          
          <Textarea
            id="formula-textarea"
            value={customConfig.formula || ''}
            onChange={(e) => handleConfigChange('formula', e.target.value)}
            placeholder={`Enter your calculation formula (e.g., ${sourceFormRefId}.field1.abc123 + ${sourceFormRefId}.field2.def456 * 0.1)`}
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
            <p>• Use the field selector above or type field references in the format: form_ref.field_ref.XXXXXX (last 6 characters)</p>
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

          <div className="space-y-2">
            <p className="text-xs font-medium">Available Fields:</p>
            <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
              {availableFields
                .filter(field => field.type !== 'calculated') // Don't show other calculated fields
                .map(field => {
                  // Use the clean field_ref we created instead of processing field.label again
                  const fieldRef = field.field_ref;
                  // Use last 6 characters without hyphens for the new format
                  const shortId = field.id.replace(/-/g, '').slice(-6);
                  const displayText = `${sourceFormRefId}.${fieldRef}.${shortId}`;
                  return (
                    <div key={field.id} className="flex items-center justify-between p-2 bg-muted rounded text-xs">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium truncate">{field.label}</span>
                        <code className="font-mono text-[10px] text-muted-foreground">{displayText}</code>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => handleFieldSelect(field.id, {
                          formRefId: sourceFormRefId,
                          fieldRef,
                          fieldId: field.id,
                          displayText,
                          originalField: field as any
                        })}
                      >
                        Insert
                      </Button>
                    </div>
                  );
                })}
              {availableFields.filter(field => field.type !== 'calculated').length === 0 && (
                <p className="text-xs text-muted-foreground">No fields available</p>
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