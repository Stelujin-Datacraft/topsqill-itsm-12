
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Type, Star, AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface HeaderFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors: Record<string, string>;
}

const HEADER_LEVELS = [
  { value: 'h1', label: 'Heading 1 (Largest)' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
  { value: 'h5', label: 'Heading 5' },
  { value: 'h6', label: 'Heading 6 (Smallest)' },
];

const HEADER_ICONS = [
  { value: 'none', label: 'No Icon', icon: null },
  { value: 'star', label: 'Star', icon: Star },
  { value: 'alert', label: 'Alert', icon: AlertTriangle },
  { value: 'info', label: 'Info', icon: Info },
  { value: 'check', label: 'Check', icon: CheckCircle },
];

const ALIGNMENTS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

export function HeaderFieldConfig({ config, onUpdate, errors }: HeaderFieldConfigProps) {
  const customConfig = config.customConfig || {};

  const handleConfigUpdate = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="header-level">Header Level</Label>
        <Select
          value={customConfig.level || 'h2'}
          onValueChange={(value) => handleConfigUpdate('level', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select header level" />
          </SelectTrigger>
          <SelectContent>
            {HEADER_LEVELS.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                {level.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="header-icon">Header Icon</Label>
        <Select
          value={customConfig.icon || 'none'}
          onValueChange={(value) => handleConfigUpdate('icon', value === 'none' ? undefined : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select icon" />
          </SelectTrigger>
          <SelectContent>
            {HEADER_ICONS.map((iconOption) => (
              <SelectItem key={iconOption.value} value={iconOption.value}>
                <div className="flex items-center gap-2">
                  {iconOption.icon && <iconOption.icon className="h-4 w-4" />}
                  {iconOption.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="header-alignment">Text Alignment</Label>
        <Select
          value={customConfig.alignment || 'left'}
          onValueChange={(value) => handleConfigUpdate('alignment', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select alignment" />
          </SelectTrigger>
          <SelectContent>
            {ALIGNMENTS.map((alignment) => (
              <SelectItem key={alignment.value} value={alignment.value}>
                {alignment.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="header-color">Text Color</Label>
        <Input
          id="header-color"
          type="color"
          value={customConfig.color || '#000000'}
          onChange={(e) => handleConfigUpdate('color', e.target.value)}
          className="w-full h-10"
        />
      </div>

      <div>
        <Label htmlFor="font-size">Font Size (px)</Label>
        <Input
          id="font-size"
          type="number"
          value={customConfig.fontSize || ''}
          onChange={(e) => handleConfigUpdate('fontSize', e.target.value ? `${e.target.value}px` : undefined)}
          placeholder="Auto"
          min="12"
          max="72"
        />
      </div>

      <div>
        <Label htmlFor="font-weight">Font Weight</Label>
        <Select
          value={customConfig.fontWeight || 'normal'}
          onValueChange={(value) => handleConfigUpdate('fontWeight', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select font weight" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="bold">Bold</SelectItem>
            <SelectItem value="lighter">Light</SelectItem>
            <SelectItem value="bolder">Extra Bold</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
