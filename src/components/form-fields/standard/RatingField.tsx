
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';
import { FormField } from '@/types/form';

interface RatingFieldProps {
  field: FormField;
  value?: number;
  onChange?: (value: number) => void;
  error?: string;
  disabled?: boolean;
}

export function RatingField({ 
  field, 
  value = 0, 
  onChange, 
  error, 
  disabled = false 
}: RatingFieldProps) {
  const [hover, setHover] = useState(0);
  const maxRating = field.customConfig?.ratingScale || 5;

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="block text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <div className="flex gap-1">
        {[...Array(maxRating)].map((_, index) => {
          const starValue = index + 1;
          return (
            <Star
              key={index}
              className={`h-6 w-6 cursor-pointer transition-colors ${
                starValue <= (hover || value)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
              onClick={() => !disabled && onChange?.(starValue)}
              onMouseEnter={() => !disabled && setHover(starValue)}
              onMouseLeave={() => !disabled && setHover(0)}
            />
          );
        })}
        {value > 0 && (
          <span className="ml-2 text-sm text-muted-foreground">
            {value} / {maxRating}
          </span>
        )}
      </div>
      
      {field.tooltip && (
        <p className="text-xs text-muted-foreground">{field.tooltip}</p>
      )}
      
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
