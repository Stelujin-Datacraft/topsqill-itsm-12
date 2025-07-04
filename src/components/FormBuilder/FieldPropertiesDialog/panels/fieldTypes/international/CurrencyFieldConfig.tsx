
import React from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface CurrencyFieldConfigProps {
  field: FormField;
  onConfigChange: (config: Record<string, any>) => void;
}

export function CurrencyFieldConfig({ field, onConfigChange }: CurrencyFieldConfigProps) {
  const config = field.customConfig || {};

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="defaultCurrency">Default Currency</Label>
        <select
          id="defaultCurrency"
          value={config.defaultCurrency || 'USD'}
          onChange={(e) => onConfigChange({ defaultCurrency: e.target.value })}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
        >
          <option value="USD">USD - US Dollar</option>
          <option value="EUR">EUR - Euro</option>
          <option value="GBP">GBP - British Pound</option>
          <option value="JPY">JPY - Japanese Yen</option>
          <option value="CAD">CAD - Canadian Dollar</option>
          <option value="AUD">AUD - Australian Dollar</option>
        </select>
      </div>

      <div>
        <Label htmlFor="precision">Decimal Places</Label>
        <Input
          id="precision"
          type="number"
          value={config.precision || 2}
          onChange={(e) => onConfigChange({ precision: parseInt(e.target.value) || 2 })}
          min="0"
          max="4"
        />
      </div>

      <div>
        <Label htmlFor="currencyList">Available Currencies</Label>
        <Input
          id="currencyList"
          value={config.currencyList?.join(', ') || ''}
          onChange={(e) => onConfigChange({ 
            currencyList: e.target.value.split(',').map(c => c.trim()).filter(c => c) 
          })}
          placeholder="e.g., USD, EUR, GBP (leave empty for all)"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="showSymbol"
            checked={config.showSymbol !== false}
            onCheckedChange={(checked) => onConfigChange({ showSymbol: checked })}
          />
          <Label htmlFor="showSymbol">Show currency symbol</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showCurrencyCode"
            checked={config.showCurrencyCode || false}
            onCheckedChange={(checked) => onConfigChange({ showCurrencyCode: checked })}
          />
          <Label htmlFor="showCurrencyCode">Show currency code</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowCurrencyChange"
            checked={config.allowCurrencyChange !== false}
            onCheckedChange={(checked) => onConfigChange({ allowCurrencyChange: checked })}
          />
          <Label htmlFor="allowCurrencyChange">Allow currency selection</Label>
        </div>
      </div>
    </div>
  );
}
