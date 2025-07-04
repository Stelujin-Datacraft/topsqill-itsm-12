
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';

interface RatingFieldProps {
  field: FormField;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  disabled?: boolean;
}

export function RatingField({ field, value, onChange, error, disabled = false }: RatingFieldProps) {
  const scale = field.customConfig?.ratingScale || 5;
  const allowHalfStars = field.customConfig?.allowHalfStars || false;
  const readOnly = field.customConfig?.readOnly || false;

  const handleStarClick = (rating: number) => {
    if (disabled || readOnly) return;
    
    if (allowHalfStars) {
      // Allow half-star ratings
      onChange(rating);
    } else {
      // Only allow whole-star ratings
      onChange(Math.ceil(rating));
    }
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= scale; i++) {
      const isFilled = value >= i;
      const isHalfFilled = allowHalfStars && value >= i - 0.5 && value < i;
      
      stars.push(
        <button
          key={i}
          type="button"
          onClick={() => handleStarClick(i)}
          disabled={disabled || readOnly}
          className={`text-2xl transition-colors ${
            disabled || readOnly ? 'cursor-not-allowed' : 'cursor-pointer hover:text-yellow-400'
          }`}
        >
          <Star 
            className={`h-6 w-6 ${
              isFilled ? 'text-yellow-400 fill-current' : 
              isHalfFilled ? 'text-yellow-400 fill-current opacity-50' : 
              'text-gray-300'
            }`} 
          />
        </button>
      );
    }
    return stars;
  };

  return (
    <div className="space-y-2">
      <Label className="block text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <div className="flex items-center gap-1">
        {renderStars()}
        {value > 0 && (
          <span className="ml-2 text-sm text-gray-600">
            {allowHalfStars ? value.toFixed(1) : Math.ceil(value)} / {scale}
          </span>
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
