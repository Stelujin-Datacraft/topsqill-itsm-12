import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFormsData } from '@/hooks/useFormsData';
import { useCurrentFormFields } from '@/hooks/useCurrentFormFields';
import { HelpDialog, HelpSection, HelpExample, HelpBadge } from '@/components/ui/help-dialog';

interface CalculatedFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors?: Record<string, string>;
}

export function CalculatedFieldConfig({ config, onUpdate, errors }: CalculatedFieldConfigProps) {
  const customConfig = config.customConfig || {};
  const { forms } = useFormsData();
  const { formFieldOptions } = useCurrentFormFields();

  const handleConfigChange = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value
      }
    });
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
            <Label htmlFor="formula">Formula</Label>
            <HelpDialog title="Formula Help & Examples">
              <HelpSection title="Available Functions">
                <div className="grid grid-cols-2 gap-2">
                  <div><HelpBadge>SUM(field_id)</HelpBadge> - Sum all values</div>
                  <div><HelpBadge>AVG(field_id)</HelpBadge> - Average of values</div>
                  <div><HelpBadge>COUNT(*)</HelpBadge> - Count records</div>
                  <div><HelpBadge>MIN(field_id)</HelpBadge> - Minimum value</div>
                  <div><HelpBadge>MAX(field_id)</HelpBadge> - Maximum value</div>
                  <div><HelpBadge>CONCAT(fields)</HelpBadge> - Join text</div>
                </div>
              </HelpSection>

              <HelpSection title="Mathematical Operations">
                <p>You can use +, -, *, /, and parentheses for complex calculations.</p>
              </HelpSection>

              <HelpSection title="Available Fields">
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {formFieldOptions.map((field) => (
                    <div key={field.value} className="text-xs">
                      <code className="bg-muted px-2 py-1 rounded">{field.value}</code> - {field.label}
                    </div>
                  ))}
                </div>
              </HelpSection>

              <HelpSection title="Examples">
                <HelpExample 
                  title="Simple Sum" 
                  code="SUM(price_field)" 
                  description="Sum all price values from submissions"
                />
                <HelpExample 
                  title="With Tax Calculation" 
                  code="SUM(price_field) * 1.08" 
                  description="Sum prices and add 8% tax"
                />
                <HelpExample 
                  title="Average with Condition" 
                  code="AVG(rating_field)" 
                  description="Calculate average rating"
                />
                <HelpExample 
                  title="Complex Formula" 
                  code="(SUM(quantity_field) * AVG(price_field)) - MIN(discount_field)" 
                  description="Calculate total with discount"
                />
                <HelpExample 
                  title="Text Concatenation" 
                  code="CONCAT(first_name, ' ', last_name)" 
                  description="Join first and last name"
                />
              </HelpSection>
            </HelpDialog>
          </div>
          <Textarea
            id="formula"
            value={customConfig.formula || ''}
            onChange={(e) => handleConfigChange('formula', e.target.value)}
            placeholder="SUM(field_id) or AVG(field_id) or COUNT(*)"
            rows={4}
          />
          <p className="text-sm text-muted-foreground">
            Click the Help button above for detailed examples and available field IDs.
          </p>
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