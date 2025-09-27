
import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CurrencyFieldProps {
  field: FormField;
  value: { amount: number; currency: string } | string;
  onChange: (value: { amount: number; currency: string }) => void;
  error?: string;
  disabled?: boolean;
}

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', rate: 1 },
  { code: 'EUR', name: 'Euro', symbol: '€', rate: 0.85 },
  { code: 'GBP', name: 'British Pound', symbol: '£', rate: 0.73 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', rate: 110 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', rate: 1.25 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', rate: 1.35 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', rate: 0.92 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', rate: 6.45 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', rate: 74 },
];

export function CurrencyField({ field, value, onChange, error, disabled }: CurrencyFieldProps) {
  const config = field.customConfig || {};
  const defaultCurrency = config.defaultCurrency || 'USD';
  
  // Parse value - handle both old string format and new object format
  const parsedValue = typeof value === 'string' 
    ? { amount: parseFloat(value) || 0, currency: defaultCurrency }
    : value || { amount: 0, currency: defaultCurrency };

  const [amount, setAmount] = useState(parsedValue.amount);
  const [currency, setCurrency] = useState(parsedValue.currency);
  const [baseAmount, setBaseAmount] = useState(parsedValue.amount); // Amount in base currency (USD)

  // Update state when value prop changes (from rules or external sources)
  useEffect(() => {
    const newParsedValue = typeof value === 'string' 
      ? { amount: parseFloat(value) || 0, currency: defaultCurrency }
      : value || { amount: 0, currency: defaultCurrency };
    
    setAmount(newParsedValue.amount);
    setCurrency(newParsedValue.currency);
    setBaseAmount(newParsedValue.amount);
  }, [value, defaultCurrency]);

  // Get available currencies
  const availableCurrencies = config.currencyList && config.currencyList.length > 0
    ? CURRENCIES.filter(c => config.currencyList.includes(c.code))
    : CURRENCIES;

  // Convert amount when currency changes
  useEffect(() => {
    if (currency !== parsedValue.currency && baseAmount > 0) {
      const fromCurrency = CURRENCIES.find(c => c.code === parsedValue.currency);
      const toCurrency = CURRENCIES.find(c => c.code === currency);
      
      if (fromCurrency && toCurrency) {
        // Convert to USD first, then to target currency
        const usdAmount = baseAmount / fromCurrency.rate;
        const convertedAmount = usdAmount * toCurrency.rate;
        setAmount(parseFloat(convertedAmount.toFixed(config.precision || 2)));
      }
    }
  }, [currency, baseAmount, parsedValue.currency, config.precision]);

  const handleAmountChange = (newAmount: number) => {
    setAmount(newAmount);
    
    // Update base amount (in USD)
    const currentCurrency = CURRENCIES.find(c => c.code === currency);
    if (currentCurrency) {
      setBaseAmount(newAmount / currentCurrency.rate);
    }
    
    onChange({ amount: newAmount, currency });
  };

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    onChange({ amount, currency: newCurrency });
  };

  const formatAmount = (amt: number) => {
    const precision = config.precision || 2;
    return amt.toFixed(precision);
  };

  const getCurrentSymbol = () => {
    const currentCurrency = CURRENCIES.find(c => c.code === currency);
    return currentCurrency?.symbol || currency;
  };

  return (
    <div className="space-y-3">
      {/* <Label htmlFor={field.id}>{field.label}</Label> */}
      
      <div className="flex gap-2">
        {/* Currency selector */}
        {config.allowCurrencyChange !== false && (
          <div className="w-32">
            <Select
              value={currency}
              onValueChange={handleCurrencyChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableCurrencies.map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    {config.showCurrencyCode ? `${curr.code} - ${curr.symbol}` : curr.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Amount input */}
        <div className="flex-1 relative">
          {config.showSymbol !== false && (
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              {getCurrentSymbol()}
            </span>
          )}
          <Input
            id={field.id}
            type="number"
            value={amount || ''}
            onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
            placeholder={field.placeholder || '0.00'}
            disabled={disabled}
            step={1 / Math.pow(10, config.precision || 2)}
            className={config.showSymbol !== false ? "pl-8" : ""}
          />
        </div>
      </div>

      {/* Currency conversion info */}
      {baseAmount > 0 && currency !== 'USD' && (
        <p className="text-xs text-gray-500">
          ≈ ${formatAmount(baseAmount)} USD
        </p>
      )}

      {config.showCurrencyCode && (
        <p className="text-xs text-gray-500">
          Currency: {currency} - {CURRENCIES.find(c => c.code === currency)?.name}
        </p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
