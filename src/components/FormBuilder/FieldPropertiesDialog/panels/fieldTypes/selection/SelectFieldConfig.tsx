
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface SelectFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function SelectFieldConfig({ field, onConfigChange }: SelectFieldConfigProps) {
  const config = field.customConfig || {};
  
  // Ensure options is always an array
  const ensureOptionsArray = (opts: any): any[] => {
    if (Array.isArray(opts)) return opts;
    if (typeof opts === 'string') {
      try {
        const parsed = JSON.parse(opts);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };
  
  const options = ensureOptionsArray(field.options);

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
            <div key={option.id || index} className="flex items-center gap-2 p-2 border rounded">
              <GripVertical className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Value"
                value={option.value || ''}
                onChange={(e) => handleOptionChange(index, 'value', e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Label"
                value={option.label || ''}
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

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="searchable"
            checked={config.searchable || false}
            onCheckedChange={(checked) => onConfigChange({ searchable: checked })}
          />
          <Label htmlFor="searchable">Enable search</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="clearable"
            checked={config.clearable !== false}
            onCheckedChange={(checked) => onConfigChange({ clearable: checked })}
          />
          <Label htmlFor="clearable">Allow clearing selection</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowOther"
            checked={config.allowOther || false}
            onCheckedChange={(checked) => onConfigChange({ allowOther: checked })}
          />
          <Label htmlFor="allowOther">Allow "Other" option</Label>
        </div>
      </div>
    </div>
  );
}
