
import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';

interface ConditionalSectionConfigPanelProps {
  field: FormField;
  onConfigChange: (config: any) => void;
}

export function ConditionalSectionConfigPanel({ field, onConfigChange }: ConditionalSectionConfigPanelProps) {
  // Local state - no auto-sync with useEffect
  const [localState, setLocalState] = useState({
    conditions: field.customConfig?.conditions || [],
    logic: field.customConfig?.logic || 'AND' as 'AND' | 'OR'
  });

  // Only update when field changes (not on every render)
  useEffect(() => {
    const newState = {
      conditions: field.customConfig?.conditions || [],
      logic: field.customConfig?.logic || 'AND' as 'AND' | 'OR'
    };
    setLocalState(newState);
  }, [field.id]); // Only depend on field.id

  // Update parent only when local state changes
  useEffect(() => {
    const config = {
      conditions: localState.conditions,
      logic: localState.logic
    };
    onConfigChange(config);
  }, [localState, onConfigChange]);

  const updateLocalState = (key: string, value: any) => {
    setLocalState(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleLogicChange = (value: string) => {
    updateLocalState('logic', value as 'AND' | 'OR');
  };

  const handleAddCondition = () => {
    const newCondition = {
      id: `condition-${Date.now()}`,
      field: '',
      operator: '==',
      value: ''
    };
    updateLocalState('conditions', [...localState.conditions, newCondition]);
  };

  const handleRemoveCondition = (conditionId: string) => {
    updateLocalState('conditions', localState.conditions.filter((c: any) => c.id !== conditionId));
  };

  const handleConditionChange = (conditionId: string, key: string, value: string) => {
    const updatedConditions = localState.conditions.map((c: any) => 
      c.id === conditionId ? { ...c, [key]: value } : c
    );
    updateLocalState('conditions', updatedConditions);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Logic</Label>
        <Select value={localState.logic} onValueChange={handleLogicChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">AND (All conditions must be true)</SelectItem>
            <SelectItem value="OR">OR (Any condition can be true)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Visibility Conditions</Label>
          <Button onClick={handleAddCondition} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add Condition
          </Button>
        </div>
        
        {localState.conditions.length > 0 && (
          <div className="space-y-2">
            {localState.conditions.map((condition: any) => (
              <Card key={condition.id}>
                <CardContent className="p-3">
                  <div className="grid grid-cols-4 gap-2 items-center">
                    <Input
                      placeholder="Field ID"
                      value={condition.field}
                      onChange={(e) => handleConditionChange(condition.id, 'field', e.target.value)}
                    />
                    
                    <Select
                      value={condition.operator}
                      onValueChange={(value) => handleConditionChange(condition.id, 'operator', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="==">=</SelectItem>
                        <SelectItem value="!=">≠</SelectItem>
                        <SelectItem value="<">&lt;</SelectItem>
                        <SelectItem value=">">&gt;</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="isEmpty">Is Empty</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Input
                      placeholder="Value"
                      value={condition.value}
                      onChange={(e) => handleConditionChange(condition.id, 'value', e.target.value)}
                    />
                    
                    <Button
                      onClick={() => handleRemoveCondition(condition.id)}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        <p>This section will be shown/hidden based on the conditions above.</p>
        <p>Use field IDs to reference other fields in the form.</p>
      </div>
    </div>
  );
}
