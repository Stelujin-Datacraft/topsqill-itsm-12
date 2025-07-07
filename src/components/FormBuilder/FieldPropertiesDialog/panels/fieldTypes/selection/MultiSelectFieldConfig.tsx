
import React from 'react';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface MultiSelectFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
}

export function MultiSelectFieldConfig({ config, onUpdate, errors }: MultiSelectFieldConfigProps) {
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
  
  const options = ensureOptionsArray(config.options);

  const handleOptionChange = (index: number, key: string, value: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [key]: value };
    onUpdate({ options: newOptions });
  };

  const addOption = () => {
    const newOptions = [...options, { id: `option_${Date.now()}`, value: '', label: '' }];
    onUpdate({ options: newOptions });
  };

  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    onUpdate({ options: newOptions });
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

      <div>
        <Label htmlFor="maxSelections">Maximum Selections</Label>
        <Input
          id="maxSelections"
          type="number"
          value={config.customConfig?.maxSelections || ''}
          onChange={(e) => onUpdate({ 
            customConfig: { 
              ...config.customConfig, 
              maxSelections: parseInt(e.target.value) || undefined 
            } 
          })}
          placeholder="Leave empty for unlimited"
          min="1"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowOther"
            checked={config.customConfig?.allowOther || false}
            onCheckedChange={(checked) => onUpdate({ 
              customConfig: { 
                ...config.customConfig, 
                allowOther: Boolean(checked) 
              } 
            })}
          />
          <Label htmlFor="allowOther">Allow "Other" option</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="searchable"
            checked={config.customConfig?.searchable !== false}
            onCheckedChange={(checked) => onUpdate({ 
              customConfig: { 
                ...config.customConfig, 
                searchable: Boolean(checked) 
              } 
            })}
          />
          <Label htmlFor="searchable">Enable search</Label>
        </div>
      </div>
    </div>
  );
}
