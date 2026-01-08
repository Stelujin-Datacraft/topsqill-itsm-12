import React from 'react';
import { FormField } from '@/types/form';
import { Star, Heart, ThumbsUp, X } from 'lucide-react';

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
  const ratingStyle = field.customConfig?.ratingStyle || 'stars';
  const allowClear = field.customConfig?.allowClear || false;
  const size = field.customConfig?.size || 'medium';

  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-6 w-6',
    large: 'h-8 w-8'
  };

  const iconSize = sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.medium;

  const handleClick = (rating: number) => {
    if (disabled || readOnly) return;
    
    // If clicking the same rating and allowClear is enabled, clear it
    if (allowClear && rating === value) {
      onChange(0);
      return;
    }
    
    if (allowHalfStars) {
      onChange(rating);
    } else {
      onChange(Math.ceil(rating));
    }
  };

  const handleClear = () => {
    if (disabled || readOnly) return;
    onChange(0);
  };

  const getFilledColor = () => {
    switch (ratingStyle) {
      case 'hearts': return 'text-red-500 fill-current';
      case 'thumbs': return 'text-green-500 fill-current';
      case 'numbers': return 'bg-primary text-primary-foreground';
      default: return 'text-yellow-400 fill-current';
    }
  };

  const getEmptyColor = () => {
    switch (ratingStyle) {
      case 'numbers': return 'bg-muted text-muted-foreground';
      default: return 'text-gray-300';
    }
  };

  const renderIcon = (index: number, isFilled: boolean, isHalfFilled: boolean) => {
    const filledClass = getFilledColor();
    const emptyClass = getEmptyColor();

    switch (ratingStyle) {
      case 'hearts':
        return (
          <Heart 
            className={`${iconSize} ${
              isFilled ? filledClass : 
              isHalfFilled ? `${filledClass} opacity-50` : 
              emptyClass
            }`} 
          />
        );
      case 'thumbs':
        return (
          <ThumbsUp 
            className={`${iconSize} ${
              isFilled ? filledClass : 
              isHalfFilled ? `${filledClass} opacity-50` : 
              emptyClass
            }`} 
          />
        );
      case 'numbers':
        return (
          <span 
            className={`${iconSize} flex items-center justify-center rounded-full text-sm font-medium ${
              isFilled ? filledClass : emptyClass
            }`}
            style={{ width: size === 'small' ? '1.5rem' : size === 'large' ? '2.5rem' : '2rem', height: size === 'small' ? '1.5rem' : size === 'large' ? '2.5rem' : '2rem' }}
          >
            {index}
          </span>
        );
      default: // stars
        return (
          <Star 
            className={`${iconSize} ${
              isFilled ? filledClass : 
              isHalfFilled ? `${filledClass} opacity-50` : 
              emptyClass
            }`} 
          />
        );
    }
  };

  const renderRatingItems = () => {
    const items = [];
    for (let i = 1; i <= scale; i++) {
      const isFilled = value >= i;
      const isHalfFilled = allowHalfStars && value >= i - 0.5 && value < i;
      
      items.push(
        <button
          key={i}
          type="button"
          onClick={() => handleClick(i)}
          disabled={disabled || readOnly}
          className={`transition-colors ${
            disabled || readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'
          }`}
        >
          {renderIcon(i, isFilled, isHalfFilled)}
        </button>
      );
    }
    return items;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {renderRatingItems()}
        {value > 0 && (
          <span className="ml-2 text-sm text-muted-foreground">
            {allowHalfStars ? value.toFixed(1) : Math.ceil(value)} / {scale}
          </span>
        )}
        {allowClear && value > 0 && !disabled && !readOnly && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-2 p-1 text-muted-foreground hover:text-destructive transition-colors"
            title="Clear rating"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {field.tooltip && (
        <p className="text-xs text-muted-foreground">{field.tooltip}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
