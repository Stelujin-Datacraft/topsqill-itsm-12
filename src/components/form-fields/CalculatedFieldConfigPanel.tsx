
import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CalculatedFieldConfigPanelProps {
  field: FormField;
  onConfigChange: (config: any) => void;
}

export function CalculatedFieldConfigPanel({ field, onConfigChange }: CalculatedFieldConfigPanelProps) {
  // Local state - sync when field.id changes
  const [localState, setLocalState] = useState({
    formula: field.customConfig?.formula || '',
    calculateOn: field.customConfig?.calculateOn || 'change' as 'change' | 'submit' | 'load',
    showFormula: field.customConfig?.showFormula || false,
    decimalPlaces: String(field.customConfig?.decimalPlaces || 2)
  });

  // Update local state when field changes
  useEffect(() => {
    const newState = {
      formula: field.customConfig?.formula || '',
      calculateOn: field.customConfig?.calculateOn || 'change' as 'change' | 'submit' | 'load',
      showFormula: field.customConfig?.showFormula || false,
      decimalPlaces: String(field.customConfig?.decimalPlaces || 2)
    };
    setLocalState(newState);
  }, [field.id]);

  // Update parent immediately when local state changes
  useEffect(() => {
    onConfigChange({
      formula: localState.formula,
      calculateOn: localState.calculateOn,
      showFormula: localState.showFormula,
      decimalPlaces: parseInt(localState.decimalPlaces) || 2
    });
  }, [localState, onConfigChange]);

  const updateLocalState = (key: string, value: any) => {
    setLocalState(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleCalculateOnChange = (value: string) => {
    updateLocalState('calculateOn', value as 'change' | 'submit' | 'load');
  };

  const handleDecimalPlacesChange = (value: string) => {
    updateLocalState('decimalPlaces', value);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Formula</Label>
        <Textarea
          value={localState.formula}
          onChange={(e) => updateLocalState('formula', e.target.value)}
          placeholder="Enter calculation formula (e.g., field1 + field2 * 0.1)"
          rows={4}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Use field IDs or labels in your formula. Supported operations: +, -, *, /, ()
        </p>
      </div>

      <div>
        <Label>Calculate On</Label>
        <Select value={localState.calculateOn} onValueChange={handleCalculateOnChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="change">Field Change</SelectItem>
            <SelectItem value="submit">Form Submit</SelectItem>
            <SelectItem value="load">Form Load</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Decimal Places</Label>
        <Select value={localState.decimalPlaces} onValueChange={handleDecimalPlacesChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0</SelectItem>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="3">3</SelectItem>
            <SelectItem value="4">4</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="show-formula"
          checked={localState.showFormula}
          onCheckedChange={(checked) => updateLocalState('showFormula', Boolean(checked))}
        />
        <Label htmlFor="show-formula">Show formula to users</Label>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Formula Help</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          <p>• Reference fields by their ID or label</p>
          <p>• Basic operations: +, -, *, /</p>
          <p>• Use parentheses for grouping: (field1 + field2) * 0.1</p>
          <p>• Functions: SUM(), AVG(), MIN(), MAX()</p>
        </CardContent>
      </Card>
    </div>
  );
}
