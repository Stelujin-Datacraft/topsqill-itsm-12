import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Star, Calendar as CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface FieldEditorProps {
  field: any;
  value: any;
  onChange: (value: any) => void;
  className?: string;
  disabled?: boolean;
}

export function FieldEditorFactory({ field, value, onChange, className = "", disabled = false }: FieldEditorProps) {
  // Ensure we have a valid field object
  if (!field || typeof field !== 'object') {
    console.error('FieldEditorFactory: Invalid field object', field);
    return <div className="text-xs text-red-500">Invalid field</div>;
  }

  const fieldType = field.field_type || field.type;
  
  console.log('FieldEditorFactory called with:', { fieldType, value, fieldLabel: field.label });
  
  switch (fieldType) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
    case 'ip-address':
    case 'submission-access':
      return (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label}`}
          className={cn("text-sm", className)}
          type={fieldType === 'email' ? 'email' : fieldType === 'url' ? 'url' : 'text'}
          disabled={disabled}
        />
      );
    
    case 'textarea':
    case 'rich-text':
      return (
        <Textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label}`}
          rows={3}
          className={cn("text-sm resize-none", className)}
          disabled={disabled}
        />
      );
    
    case 'number':
    case 'currency':
      return (
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label}`}
          className={cn("text-sm", className)}
          min={field.validation?.min}
          max={field.validation?.max}
          step={field.customConfig?.step || 1}
          disabled={disabled}
        />
      );
    
    case 'date':
    case 'time':
    case 'datetime':
      return (
        <div className={cn("flex items-center space-x-2", className)}>
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <Input
            type={fieldType === 'date' ? 'date' : fieldType === 'time' ? 'time' : 'datetime-local'}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="text-sm flex-1"
            disabled={disabled}
          />
        </div>
      );
    
    case 'select':
    case 'dropdown':
    case 'country':
      const selectOptions = field.options || field.field_options?.options || [];
      return (
        <Select
          value={value || ''}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger className={cn("text-sm", className)}>
            <SelectValue placeholder={`Select ${field.label}`} />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-md z-50">
            {Array.isArray(selectOptions) ? selectOptions.map((option: any) => (
              <SelectItem key={option.value || option} value={option.value || option}>
                {option.label || option}
              </SelectItem>
            )) : null}
          </SelectContent>
        </Select>
      );
    
    case 'multi-select':
      const multiSelectOptions = field.options || field.field_options?.options || [];
      const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);
      
      return (
        <div className={cn("space-y-2", className)}>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                disabled={disabled}
              >
                {selectedValues.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedValues.slice(0, 2).map((val: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {String(val)}
                      </Badge>
                    ))}
                    {selectedValues.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{selectedValues.length - 2} more
                      </Badge>
                    )}
                  </div>
                ) : (
                  `Select ${field.label}`
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <div className="p-2 space-y-1">
                {Array.isArray(multiSelectOptions) ? multiSelectOptions.map((option: any) => {
                  const optionValue = option.value || option;
                  const optionLabel = option.label || option;
                  const isSelected = selectedValues.includes(optionValue);
                  
                  return (
                    <div key={optionValue} className="flex items-center space-x-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onChange([...selectedValues, optionValue]);
                          } else {
                            onChange(selectedValues.filter((val: string) => val !== optionValue));
                          }
                        }}
                      />
                      <label className="text-sm">{optionLabel}</label>
                    </div>
                  );
                }) : null}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      );
    
    case 'checkbox':
      return (
        <div className={cn("flex items-center space-x-2", className)}>
          <Checkbox
            checked={value === true || value === 'true'}
            onCheckedChange={onChange}
            disabled={disabled}
          />
          <label className="text-sm">{field.label}</label>
        </div>
      );
    
    case 'toggle-switch':
      return (
        <div className={cn("flex items-center space-x-2", className)}>
          <Switch
            checked={value === true || value === 'true'}
            onCheckedChange={onChange}
            disabled={disabled}
          />
          <label className="text-sm">{field.label}</label>
        </div>
      );
    
    case 'radio':
      const radioOptions = field.options || field.field_options?.options || [];
      return (
        <RadioGroup
          value={value || ''}
          onValueChange={onChange}
          disabled={disabled}
          className={cn("space-y-2", className)}
        >
          {Array.isArray(radioOptions) ? radioOptions.map((option: any) => (
            <div key={option.value || option} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value || option} id={`${field.id}-${option.value || option}`} />
              <Label htmlFor={`${field.id}-${option.value || option}`} className="text-sm">
                {option.label || option}
              </Label>
            </div>
          )) : null}
        </RadioGroup>
      );
    
    case 'rating':
      const maxRating = field.customConfig?.ratingScale || 5;
      return (
        <div className={cn("flex items-center space-x-1", className)}>
          {[...Array(maxRating)].map((_, index) => {
            const starValue = index + 1;
            return (
              <Star
                key={index}
                className={`h-4 w-4 cursor-pointer transition-colors ${
                  starValue <= (value || 0)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
                onClick={() => !disabled && onChange(starValue)}
              />
            );
          })}
          {value > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              {value}/{maxRating}
            </span>
          )}
        </div>
      );
    
    case 'slider':
      const min = field.validation?.min || 0;
      const max = field.validation?.max || 100;
      return (
        <div className={cn("space-y-2", className)}>
          <Slider
            value={[value || min]}
            onValueChange={(newValue) => onChange(newValue[0])}
            min={min}
            max={max}
            step={field.customConfig?.step || 1}
            className="w-full"
            disabled={disabled}
          />
          <div className="text-xs text-muted-foreground text-center">
            {value || min} / {max}
          </div>
        </div>
      );
    
    case 'color':
      return (
        <div className={cn("flex items-center space-x-2", className)}>
          <Input
            type="color"
            value={value || '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-8 p-1 border rounded"
            disabled={disabled}
          />
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="text-sm flex-1"
            disabled={disabled}
          />
        </div>
      );
    
    case 'file':
    case 'image':
    case 'signature':
      return (
        <div className={className}>
          <Input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onChange(file.name);
              }
            }}
            className="text-sm w-full"
            accept={fieldType === 'image' ? 'image/*' : undefined}
            disabled={disabled}
          />
          {value && (
            <div className="text-xs text-muted-foreground mt-1 truncate">
              Current: {value}
            </div>
          )}
        </div>
      );
    
    case 'tags':
      const tagList = Array.isArray(value) ? value : (value ? String(value).split(',').map((tag: string) => tag.trim()) : []);
      return (
        <div className={cn("space-y-2", className)}>
          <Input
            value={tagList.join(', ')}
            onChange={(e) => {
              const tags = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean);
              onChange(tags);
            }}
            placeholder="Enter tags separated by commas"
            className="text-sm w-full"
            disabled={disabled}
          />
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tagList.map((tag: string, index: number) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {String(tag)}
                  {!disabled && (
                    <X 
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => {
                        const newTags = tagList.filter((_: string, i: number) => i !== index);
                        onChange(newTags);
                      }}
                    />
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>
      );
    
    case 'address':
      const addressValue = typeof value === 'object' ? value : {};
      return (
        <div className={cn("space-y-2", className)}>
          <Input
            value={addressValue.street || ''}
            onChange={(e) => onChange({ ...addressValue, street: e.target.value })}
            placeholder="Street"
            className="text-sm w-full"
            disabled={disabled}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={addressValue.city || ''}
              onChange={(e) => onChange({ ...addressValue, city: e.target.value })}
              placeholder="City"
              className="text-sm"
              disabled={disabled}
            />
            <Input
              value={addressValue.zip || ''}
              onChange={(e) => onChange({ ...addressValue, zip: e.target.value })}
              placeholder="ZIP"
              className="text-sm"
              disabled={disabled}
            />
          </div>
          <Input
            value={addressValue.country || ''}
            onChange={(e) => onChange({ ...addressValue, country: e.target.value })}
            placeholder="Country"
            className="text-sm w-full"
            disabled={disabled}
          />
        </div>
      );
    
    case 'geo-location':
      const geoValue = typeof value === 'object' ? value : {};
      return (
        <div className={cn("grid grid-cols-2 gap-2", className)}>
          <Input
            type="number"
            value={geoValue.lat || ''}
            onChange={(e) => onChange({ ...geoValue, lat: parseFloat(e.target.value) })}
            placeholder="Latitude"
            className="text-sm"
            step="any"
            disabled={disabled}
          />
          <Input
            type="number"
            value={geoValue.lng || ''}
            onChange={(e) => onChange({ ...geoValue, lng: parseFloat(e.target.value) })}
            placeholder="Longitude"
            className="text-sm"
            step="any"
            disabled={disabled}
          />
        </div>
      );
    
    case 'user-picker':
    case 'group-picker':
      return (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Select ${field.label}`}
          className={cn("text-sm", className)}
          disabled={disabled}
        />
      );
    
    case 'barcode':
      return (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Scan or enter barcode"
          className={cn("text-sm", className)}
          disabled={disabled}
        />
      );
    
    // Non-editable field types
    case 'header':
    case 'description':
    case 'section-break':
    case 'horizontal-line':
    case 'full-width-container':
    case 'record-table':
    case 'matrix-grid':
    case 'cross-reference':
    case 'child-cross-reference':
    case 'calculated':
    case 'conditional-section':
    case 'workflow-trigger':
    case 'query-field':
      return (
        <div className={cn("text-xs text-muted-foreground italic p-2 bg-muted/20 rounded", className)}>
          Non-editable: {fieldType}
        </div>
      );
    
    default:
      console.log('FieldEditorFactory: Unknown field type:', fieldType);
      return (
        <Input
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label || 'value'}`}
          className={cn("text-sm", className)}
          disabled={disabled}
        />
      );
  }
}