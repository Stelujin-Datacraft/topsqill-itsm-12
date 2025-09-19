import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DynamicDropdownFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
  formData?: Record<string, any>;
}

interface DropdownOption {
  value: string;
  label: string;
}

export function DynamicDropdownField({ 
  field, 
  value, 
  onChange, 
  error, 
  disabled,
  formData = {}
}: DynamicDropdownFieldProps) {
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [loading, setLoading] = useState(false);
  const config = (field.customConfig as any) || {};

  useEffect(() => {
    loadOptions();
  }, [config.sourceFormId, config.dependentFieldId, formData[config.dependentFieldId]]);

  const loadOptions = async () => {
    if (!config.dataSource) return;

    setLoading(true);
    try {
      let fetchedOptions: DropdownOption[] = [];

      switch (config.dataSource) {
        case 'form':
          fetchedOptions = await loadFormOptions();
          break;
        case 'api':
          fetchedOptions = await loadApiOptions();
          break;
        case 'dependent':
          fetchedOptions = await loadDependentOptions();
          break;
      }

      setOptions(fetchedOptions);
    } catch (error) {
      console.error('Error loading dynamic dropdown options:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFormOptions = async (): Promise<DropdownOption[]> => {
    if (!config.sourceFormId || !config.displayField || !config.valueField) {
      return [];
    }

    const { data: submissions, error } = await supabase
      .from('form_submissions')
      .select('submission_data')
      .eq('form_id', config.sourceFormId)
      .limit(100);

    if (error) throw error;

    const options: DropdownOption[] = [];
    const seen = new Set();

    submissions?.forEach((submission) => {
      const data = submission.submission_data as Record<string, any>;
      const displayValue = data[config.displayField];
      const valueField = data[config.valueField];

      if (displayValue && valueField && !seen.has(valueField)) {
        seen.add(valueField);
        options.push({
          value: String(valueField),
          label: String(displayValue)
        });
      }
    });

    return options.sort((a, b) => a.label.localeCompare(b.label));
  };

  const loadApiOptions = async (): Promise<DropdownOption[]> => {
    if (!config.apiEndpoint) return [];

    const headers = {
      'Content-Type': 'application/json',
      ...config.apiHeaders,
    };

    const response = await fetch(config.apiEndpoint, { headers });
    if (!response.ok) throw new Error('API request failed');

    const data = await response.json();
    
    // Assume API returns array of objects with value and label properties
    if (Array.isArray(data)) {
      return data.map((item) => ({
        value: String(item.value || item.id),
        label: String(item.label || item.name || item.title)
      }));
    }

    return [];
  };

  const loadDependentOptions = async (): Promise<DropdownOption[]> => {
    const dependentValue = formData[config.dependentFieldId];
    if (!dependentValue) return [];

    // In a real implementation, this would load options based on the dependent field value
    // For now, return some mock options
    const mockOptions = [
      { value: `${dependentValue}_option1`, label: `${dependentValue} Option 1` },
      { value: `${dependentValue}_option2`, label: `${dependentValue} Option 2` },
      { value: `${dependentValue}_option3`, label: `${dependentValue} Option 3` },
    ];

    return mockOptions;
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>{field.label}</Label>
      
      <Select
        value={value === '' ? '__empty__' : value || '__empty__'}
        onValueChange={(val) => onChange?.(val === '__empty__' ? '' : val)}
        disabled={disabled || loading}
      >
        <SelectTrigger>
          <SelectValue placeholder={
            loading ? "Loading options..." : 
            field.placeholder || "Select an option"
          }>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {config.allowEmpty !== false && (
            <SelectItem value="__empty__">
              <em>None selected</em>
            </SelectItem>
          )}
          {options.filter(option => option.value && option.value.trim() !== '').map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
          {!loading && options.length === 0 && (
            <SelectItem value="__no_options__" disabled>
              <em>No options available</em>
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      {loading && (
        <p className="text-sm text-blue-600 flex items-center">
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
          Loading options...
        </p>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}