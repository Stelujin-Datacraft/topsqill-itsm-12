
import React from 'react';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CurrencyFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
}

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
];

export function CurrencyFieldConfig({ config, onUpdate, errors }: CurrencyFieldConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="defaultCurrency">Default Currency</Label>
        <Select
          value={config.customConfig?.defaultCurrency || 'USD'}
          onValueChange={(value) => onUpdate({ 
            customConfig: { 
              ...config.customConfig, 
              defaultCurrency: value 
            } 
          })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((currency) => (
              <SelectItem key={currency.code} value={currency.code}>
                {currency.code} - {currency.name} ({currency.symbol})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="precision">Decimal Places</Label>
        <Input
          id="precision"
          type="number"
          value={config.customConfig?.precision || 2}
          onChange={(e) => onUpdate({ 
            customConfig: { 
              ...config.customConfig, 
              precision: parseInt(e.target.value) || 2 
            } 
          })}
          min="0"
          max="4"
        />
      </div>

      <div>
        <Label htmlFor="allowedCurrencies">Allowed Currencies</Label>
        <Input
          id="allowedCurrencies"
          value={config.customConfig?.currencyList?.join(', ') || ''}
          onChange={(e) => onUpdate({ 
            customConfig: { 
              ...config.customConfig, 
              currencyList: e.target.value.split(',').map(c => c.trim()).filter(c => c) 
            } 
          })}
          placeholder="e.g., USD, EUR, GBP (leave empty for all)"
        />
        <p className="text-xs text-gray-500 mt-1">
          Comma-separated list of currency codes
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="showSymbol"
            checked={config.customConfig?.showSymbol !== false}
            onCheckedChange={(checked) => onUpdate({ 
              customConfig: { 
                ...config.customConfig, 
                showSymbol: Boolean(checked) 
              } 
            })}
          />
          <Label htmlFor="showSymbol">Show currency symbol</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showCurrencyCode"
            checked={config.customConfig?.showCurrencyCode || false}
            onCheckedChange={(checked) => onUpdate({ 
              customConfig: { 
                ...config.customConfig, 
                showCurrencyCode: Boolean(checked) 
              } 
            })}
          />
          <Label htmlFor="showCurrencyCode">Show currency code</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowCurrencyChange"
            checked={config.customConfig?.allowCurrencyChange !== false}
            onCheckedChange={(checked) => onUpdate({ 
              customConfig: { 
                ...config.customConfig, 
                allowCurrencyChange: Boolean(checked) 
              } 
            })}
          />
          <Label htmlFor="allowCurrencyChange">Allow currency selection</Label>
        </div>
      </div>
    </div>
  );
}
