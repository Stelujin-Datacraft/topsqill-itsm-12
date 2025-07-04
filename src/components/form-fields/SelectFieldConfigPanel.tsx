
import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface SelectFieldConfigPanelProps {
  field: FormField;
  onConfigChange: (config: any) => void;
}

export function SelectFieldConfigPanel({ field, onConfigChange }: SelectFieldConfigPanelProps) {
  // Local state - sync when field.id changes
  const [localState, setLocalState] = useState({
    options: field.options || [],
    maxSelections: field.customConfig?.maxSelections ? String(field.customConfig.maxSelections) : '',
    allowOther: field.customConfig?.allowOther || false
  });

  // Update local state when field changes
  useEffect(() => {
    const newState = {
      options: field.options || [],
      maxSelections: field.customConfig?.maxSelections ? String(field.customConfig.maxSelections) : '',
      allowOther: field.customConfig?.allowOther || false
    };
    setLocalState(newState);
  }, [field.id]);

  // Update parent immediately when local state changes
  useEffect(() => {
    onConfigChange({
      maxSelections: localState.maxSelections ? parseInt(localState.maxSelections) : undefined,
      allowOther: localState.allowOther,
      options: localState.options
    });
  }, [localState, onConfigChange]);

  const updateLocalState = (key: string, value: any) => {
    setLocalState(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleAddOption = () => {
    const newOption = {
      id: `option-${Date.now()}`,
      value: '',
      label: ''
    };
    updateLocalState('options', [...localState.options, newOption]);
  };

  const handleRemoveOption = (optionId: string) => {
    updateLocalState('options', localState.options.filter((opt: any) => opt.id !== optionId));
  };

  const handleOptionChange = (optionId: string, key: string, value: string) => {
    const updatedOptions = localState.options.map((opt: any) => 
      opt.id === optionId ? { ...opt, [key]: value } : opt
    );
    updateLocalState('options', updatedOptions);
  };

  return (
    <div className="space-y-4">
      {/* Options Management */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Options</Label>
          <Button onClick={handleAddOption} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add Option
          </Button>
        </div>
        
        {localState.options.length > 0 && (
          <div className="space-y-2">
            {localState.options.map((option: any) => (
              <Card key={option.id}>
                <CardContent className="p-3">
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <Input
                      placeholder="Value"
                      value={option.value}
                      onChange={(e) => handleOptionChange(option.id, 'value', e.target.value)}
                    />
                    <Input
                      placeholder="Label"
                      value={option.label}
                      onChange={(e) => handleOptionChange(option.id, 'label', e.target.value)}
                    />
                    <Button
                      onClick={() => handleRemoveOption(option.id)}
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

      {/* Multi-select specific options */}
      {field.type === 'multi-select' && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="max-selections">Maximum Selections</Label>
            <Input
              id="max-selections"
              type="number"
              min="1"
              value={localState.maxSelections}
              onChange={(e) => updateLocalState('maxSelections', e.target.value)}
              placeholder="No limit"
            />
          </div>
        </div>
      )}

      {/* Allow Other Option */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="allow-other"
          checked={localState.allowOther}
          onCheckedChange={(checked) => updateLocalState('allowOther', Boolean(checked))}
        />
        <Label htmlFor="allow-other">Allow "Other" option</Label>
      </div>
    </div>
  );
}
