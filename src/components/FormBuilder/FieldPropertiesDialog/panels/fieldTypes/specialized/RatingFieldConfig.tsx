
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface RatingFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function RatingFieldConfig({ field, onConfigChange }: RatingFieldConfigProps) {
  const config = field.customConfig || {};

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="ratingScale">Rating Scale</Label>
        <select
          id="ratingScale"
          value={config.ratingScale || 5}
          onChange={(e) => onConfigChange({ ratingScale: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
        >
          <option value={3}>3 Stars</option>
          <option value={5}>5 Stars</option>
          <option value={10}>10 Stars</option>
        </select>
      </div>

      <div>
        <Label htmlFor="ratingStyle">Rating Style</Label>
        <select
          id="ratingStyle"
          value={config.ratingStyle || 'stars'}
          onChange={(e) => onConfigChange({ ratingStyle: e.target.value })}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
        >
          <option value="stars">Stars</option>
          <option value="hearts">Hearts</option>
          <option value="thumbs">Thumbs Up/Down</option>
          <option value="numbers">Numbers</option>
        </select>
      </div>

      <div>
        <Label htmlFor="size">Size</Label>
        <select
          id="size"
          value={config.size || 'medium'}
          onChange={(e) => onConfigChange({ size: e.target.value })}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowHalfStars"
            checked={config.allowHalfStars || false}
            onCheckedChange={(checked) => onConfigChange({ allowHalfStars: checked })}
          />
          <Label htmlFor="allowHalfStars">Allow half ratings</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showLabels"
            checked={config.showLabels || false}
            onCheckedChange={(checked) => onConfigChange({ showLabels: checked })}
          />
          <Label htmlFor="showLabels">Show rating labels</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowClear"
            checked={config.allowClear || false}
            onCheckedChange={(checked) => onConfigChange({ allowClear: checked })}
          />
          <Label htmlFor="allowClear">Allow clearing rating</Label>
        </div>
      </div>
    </div>
  );
}
