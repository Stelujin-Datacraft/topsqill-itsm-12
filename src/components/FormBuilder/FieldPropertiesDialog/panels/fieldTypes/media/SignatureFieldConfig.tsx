
import React from 'react';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SignatureFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
}

export function SignatureFieldConfig({ config, onUpdate, errors }: SignatureFieldConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="penColor">Pen Color</Label>
        <Input
          id="penColor"
          type="color"
          value={config.customConfig?.penColor || '#000000'}
          onChange={(e) => onUpdate({ 
            customConfig: { 
              ...config.customConfig, 
              penColor: e.target.value 
            } 
          })}
        />
      </div>

      <div>
        <Label htmlFor="canvasWidth">Canvas Width (px)</Label>
        <Input
          id="canvasWidth"
          type="number"
          value={config.customConfig?.canvasWidth || 400}
          onChange={(e) => onUpdate({ 
            customConfig: { 
              ...config.customConfig, 
              canvasWidth: parseInt(e.target.value) || 400 
            } 
          })}
          min="200"
          max="800"
        />
      </div>

      <div>
        <Label htmlFor="canvasHeight">Canvas Height (px)</Label>
        <Input
          id="canvasHeight"
          type="number"
          value={config.customConfig?.canvasHeight || 200}
          onChange={(e) => onUpdate({ 
            customConfig: { 
              ...config.customConfig, 
              canvasHeight: parseInt(e.target.value) || 200 
            } 
          })}
          min="100"
          max="400"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="showTimestamp"
            checked={config.customConfig?.showTimestamp || false}
            onCheckedChange={(checked) => onUpdate({ 
              customConfig: { 
                ...config.customConfig, 
                showTimestamp: Boolean(checked) 
              } 
            })}
          />
          <Label htmlFor="showTimestamp">Show timestamp on signature</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="undoEnabled"
            checked={config.customConfig?.undoEnabled !== false}
            onCheckedChange={(checked) => onUpdate({ 
              customConfig: { 
                ...config.customConfig, 
                undoEnabled: Boolean(checked) 
              } 
            })}
          />
          <Label htmlFor="undoEnabled">Enable undo button</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="clearOnDoubleTap"
            checked={config.customConfig?.clearOnDoubleTap || false}
            onCheckedChange={(checked) => onUpdate({ 
              customConfig: { 
                ...config.customConfig, 
                clearOnDoubleTap: Boolean(checked) 
              } 
            })}
          />
          <Label htmlFor="clearOnDoubleTap">Clear on double tap</Label>
        </div>
      </div>
    </div>
  );
}
