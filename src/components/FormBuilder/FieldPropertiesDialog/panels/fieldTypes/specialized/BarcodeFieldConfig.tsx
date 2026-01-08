import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BarcodeFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors?: Record<string, string>;
}

export function BarcodeFieldConfig({ config, onUpdate, errors }: BarcodeFieldConfigProps) {
  const customConfig = config.customConfig || {};

  const handleConfigChange = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">QR/Barcode Configuration</h3>
        
        <div className="space-y-2">
          <Label htmlFor="url">URL to Encode</Label>
          <Input
            id="url"
            type="url"
            value={customConfig.url || ''}
            onChange={(e) => handleConfigChange('url', e.target.value)}
            placeholder="https://example.com"
          />
          <p className="text-sm text-muted-foreground">
            The URL that will be encoded in the QR/barcode
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="barcodeType">Barcode Type</Label>
          <Select
            value={customConfig.barcodeType || 'qr'}
            onValueChange={(value) => handleConfigChange('barcodeType', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select barcode type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qr">QR Code</SelectItem>
              <SelectItem value="code128">Code 128</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="size">Size (pixels)</Label>
          <Input
            id="size"
            type="number"
            min="50"
            max="500"
            value={customConfig.size || 200}
            onChange={(e) => handleConfigChange('size', parseInt(e.target.value) || 200)}
            placeholder="200"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showText"
            checked={customConfig.showText !== false}
            onCheckedChange={(checked) => handleConfigChange('showText', checked)}
          />
          <Label htmlFor="showText">Show URL text below barcode</Label>
        </div>
      </div>
    </div>
  );
}