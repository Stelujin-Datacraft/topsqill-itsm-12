
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface RadioFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function RadioFieldConfig({ field, onConfigChange }: RadioFieldConfigProps) {
  const config = field.customConfig || {};
  const options = field.options || [];

  const handleOptionChange = (index: number, key: string, value: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [key]: value };
    onConfigChange({ options: newOptions });
  };

  const addOption = () => {
    const newOptions = [...options, { id: `option_${Date.now()}`, value: '', label: '' }];
    onConfigChange({ options: newOptions });
  };

  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    onConfigChange({ options: newOptions });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Options</Label>
        <div className="space-y-2 mt-2">
          {options.map((option, index) => (
            <div key={option.id} className="flex items-center gap-2 p-2 border rounded">
              <GripVertical className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Value"
                value={option.value}
                onChange={(e) => handleOptionChange(index, 'value', e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Label"
                value={option.label}
                onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeOption(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button onClick={addOption} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Option
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Orientation</Label>
        <RadioGroup
          value={config.orientation || 'vertical'}
          onValueChange={(value) => onConfigChange({ orientation: value })}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="vertical" id="vertical" />
            <Label htmlFor="vertical">Vertical</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="horizontal" id="horizontal" />
            <Label htmlFor="horizontal">Horizontal</Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
