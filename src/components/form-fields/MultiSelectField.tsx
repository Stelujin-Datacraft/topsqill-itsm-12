
import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Search } from 'lucide-react';

interface MultiSelectFieldProps {
  field: FormField;
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  disabled?: boolean;
  fieldState?: any;
}

export function MultiSelectField({ field, value = [], onChange, error, disabled, fieldState }: MultiSelectFieldProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherValue, setOtherValue] = useState('');

  const config = field.customConfig || {};
  const maxSelections = config.maxSelections ? Number(config.maxSelections) : undefined;
  // Use fieldState.options if available (from rules), otherwise use field.options
  const options = fieldState?.options || field.options || [];
  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOptionChange = (optionValue: string, checked: boolean) => {
    if (disabled) return;
    
    let newValue = [...value];
    if (checked) {
      if (maxSelections && newValue.length >= maxSelections) {
        return; // Don't add if max selections reached
      }
      newValue.push(optionValue);
    } else {
      newValue = newValue.filter(v => v !== optionValue);
    }
    onChange(newValue);
  };

  const handleRemoveSelection = (optionValue: string) => {
    if (disabled) return;
    const newValue = value.filter(v => v !== optionValue);
    onChange(newValue);
  };

  const handleAddOther = () => {
    if (otherValue.trim() && !value.includes(`other:${otherValue}`)) {
      const newValue = [...value, `other:${otherValue}`];
      onChange(newValue);
      setOtherValue('');
      setShowOtherInput(false);
    }
  };

  return (
    <>
      {/* Selected items display */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((selectedValue) => {
            const option = options.find(opt => opt.value === selectedValue);
            const displayLabel = option ? option.label : 
              selectedValue.startsWith('other:') ? selectedValue.replace('other:', '') : selectedValue;
            
            return (
              <Badge key={selectedValue} variant="secondary" className="flex items-center gap-2 px-2 py-1">
                {option?.image && (
                  <img 
                    src={option.image} 
                    alt={displayLabel || 'Option image'} 
                    className="w-8 h-8 object-cover rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                {!option?.image && option?.color && (
                  <div 
                    className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" 
                    style={{ backgroundColor: option.color }}
                  />
                )}
                {displayLabel && <span className="text-xs">{displayLabel}</span>}
                {!disabled && (
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleRemoveSelection(selectedValue)}
                  />
                )}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Search input */}
      {config.searchable !== false && (
        <div className={`relative ${value.length > 0 ? 'mt-2' : ''}`}>
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search options..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            disabled={disabled}
          />
        </div>
      )}

      {/* Options list */}
      <div className={`space-y-2 border rounded p-3 bg-background ${(value.length > 0 || config.searchable !== false) ? 'mt-2' : ''} ${filteredOptions.length > 7 ? 'max-h-64 overflow-y-auto' : ''}`}>
        {filteredOptions.map((option) => (
          <div key={option.id} className="flex items-center space-x-2">
            <Checkbox
              id={`${field.id}-${option.id}`}
              checked={value.includes(option.value)}
              onCheckedChange={(checked) => handleOptionChange(option.value, Boolean(checked))}
              disabled={disabled || (maxSelections && value.length >= maxSelections && !value.includes(option.value))}
            />
            <Label htmlFor={`${field.id}-${option.id}`} className="flex-1 cursor-pointer flex items-center gap-3">
              {option.image && (
                <img 
                  src={option.image} 
                  alt={option.label || 'Option image'} 
                  className="w-16 h-16 object-cover rounded border border-border flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              {!option.image && option.color && (
                <div 
                  className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" 
                  style={{ backgroundColor: option.color }}
                />
              )}
              {option.label && <span className="text-sm">{option.label}</span>}
            </Label>
          </div>
        ))}

        {/* Allow Other option */}
        {config.allowOther && (
          <div className="border-t pt-2 mt-2">
            {!showOtherInput ? (
              <button
                type="button"
                onClick={() => setShowOtherInput(true)}
                className="text-sm text-blue-600 hover:text-blue-800"
                disabled={disabled}
              >
                + Add other option
              </button>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter other option"
                  value={otherValue}
                  onChange={(e) => setOtherValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddOther()}
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={handleAddOther}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                  disabled={disabled}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Max selections info */}
      {maxSelections && (
        <p className={`text-xs mt-1 ${value.length >= maxSelections ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
          {value.length}/{maxSelections} selections made
          {value.length >= maxSelections && ' (maximum reached)'}
        </p>
      )}

      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </>
  );
}
