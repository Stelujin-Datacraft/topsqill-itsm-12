
import React, { useState, KeyboardEvent } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface TagsFieldProps {
  field: FormField;
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  disabled?: boolean;
}

export function TagsField({ field, value = [], onChange, error, disabled = false }: TagsFieldProps) {
  const [inputValue, setInputValue] = useState('');
  const maxTags = field.customConfig?.maxTags;
  const readOnly = field.customConfig?.readOnly || false;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    } else if (e.key === ',' || e.key === ' ') {
      // Allow comma and space to add tags, but don't prevent the comma from being typed
      if (e.key === ',') {
        e.preventDefault();
      }
      // For space, only add tag if there's content and it doesn't end with a space already
      if (e.key === ' ' && inputValue.trim() && !inputValue.endsWith(' ')) {
        e.preventDefault();
        addTag();
      } else if (e.key === ',') {
        addTag();
      }
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      // Remove last tag if input is empty
      onChange(value.slice(0, -1));
    }
  };

  const addTag = () => {
    const trimmedValue = inputValue.trim();
    
    // Handle comma-separated tags
    const tags = trimmedValue.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    
    const newTags = tags.filter(tag => !value.includes(tag));
    if (newTags.length > 0) {
      const totalNewTags = value.length + newTags.length;
      if (!maxTags || totalNewTags <= maxTags) {
        onChange([...value, ...newTags]);
        setInputValue('');
      } else if (maxTags && value.length < maxTags) {
        // Add as many as possible within the limit
        const availableSlots = maxTags - value.length;
        const tagsToAdd = newTags.slice(0, availableSlots);
        onChange([...value, ...tagsToAdd]);
        setInputValue('');
      }
    } else {
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    if (!disabled && !readOnly) {
      onChange(value.filter(tag => tag !== tagToRemove));
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="block text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
        {maxTags && <span className="text-xs text-gray-500 ml-2">({value.length}/{maxTags})</span>}
      </Label>
      
      <div className={`min-h-[42px] border rounded-md p-2 flex flex-wrap gap-2 ${error ? 'border-red-500' : 'border-gray-300'} ${disabled || readOnly ? 'bg-gray-50' : 'bg-white'}`}>
        {value.map((tag, index) => (
          <Badge key={index} variant="secondary" className="flex items-center gap-1">
            {tag}
            {!disabled && !readOnly && (
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        
        {(!maxTags || value.length < maxTags) && !disabled && !readOnly && (
          <Input
            id={field.id}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            placeholder={value.length === 0 ? field.placeholder || 'Type and press Enter...' : ''}
            className="border-none shadow-none p-0 h-auto flex-1 min-w-[120px] focus-visible:ring-0"
          />
        )}
      </div>
      
      {field.tooltip && (
        <p className="text-xs text-gray-500">{field.tooltip}</p>
      )}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
