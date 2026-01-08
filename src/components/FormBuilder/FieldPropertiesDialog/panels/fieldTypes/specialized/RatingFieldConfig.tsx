import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings2, Star } from 'lucide-react';

interface RatingFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function RatingFieldConfig({ field, onConfigChange }: RatingFieldConfigProps) {
  const config = (field.customConfig || {}) as Record<string, any>;

  return (
    <div className="space-y-4">
      {/* Rating Scale Configuration */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Star className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Rating Configuration</h4>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ratingScale">Rating Scale</Label>
          <Select
            value={String(config.ratingScale || 5)}
            onValueChange={(value) => onConfigChange({ ratingScale: parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="3">3 Stars</SelectItem>
              <SelectItem value="5">5 Stars</SelectItem>
              <SelectItem value="10">10 Stars</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ratingStyle">Rating Style</Label>
          <Select
            value={config.ratingStyle || 'stars'}
            onValueChange={(value) => onConfigChange({ ratingStyle: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="stars">Stars</SelectItem>
              <SelectItem value="hearts">Hearts</SelectItem>
              <SelectItem value="thumbs">Thumbs Up/Down</SelectItem>
              <SelectItem value="numbers">Numbers</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="size">Size</Label>
          <Select
            value={config.size || 'medium'}
            onValueChange={(value) => onConfigChange({ size: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Display Options */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Display Options</h4>
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
    </div>
  );
}
