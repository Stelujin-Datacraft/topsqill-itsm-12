import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PhoneFieldProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

// Common country codes for phone numbers
const COUNTRY_CODES = [
  { code: '+1', country: 'US', name: 'United States' },
  { code: '+1', country: 'CA', name: 'Canada' },
  { code: '+44', country: 'GB', name: 'United Kingdom' },
  { code: '+33', country: 'FR', name: 'France' },
  { code: '+49', country: 'DE', name: 'Germany' },
  { code: '+81', country: 'JP', name: 'Japan' },
  { code: '+61', country: 'AU', name: 'Australia' },
  { code: '+55', country: 'BR', name: 'Brazil' },
  { code: '+91', country: 'IN', name: 'India' },
  { code: '+86', country: 'CN', name: 'China' },
];

export function PhoneField({ field, value, onChange, error, disabled }: PhoneFieldProps) {
  const config = field.customConfig || {};
  const [countryCode, setCountryCode] = useState(config.defaultCountry || '+1');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Parse existing value
  useEffect(() => {
    if (value && value.includes(' ')) {
      const [code, number] = value.split(' ');
      setCountryCode(code);
      setPhoneNumber(number);
    } else if (value) {
      setPhoneNumber(value);
    }
  }, [value]);

  const handleCountryChange = (newCountryCode: string) => {
    setCountryCode(newCountryCode);
    if (phoneNumber) {
      onChange(`${newCountryCode} ${phoneNumber}`);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let number = e.target.value;
    
    // Auto-format if enabled
    if (config.autoFormat) {
      number = number.replace(/\D/g, ''); // Remove non-digits
      if (number.length >= 6) {
        number = number.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
      } else if (number.length >= 3) {
        number = number.replace(/(\d{3})(\d{3})/, '($1) $2');
      }
    }
    
    setPhoneNumber(number);
    onChange((config as any).showCountryCode !== false ? `${countryCode} ${number}` : number);
  };

  const validatePhoneFormat = (phone: string) => {
    if (!(config as any).formatValidation) return true;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  };

  const displayError = error || (phoneNumber && !validatePhoneFormat(phoneNumber) ? 'Invalid phone number format' : '');

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <div className="flex gap-2">
        {config.showCountrySelector !== false && (
          <Select
            value={countryCode}
            onValueChange={handleCountryChange}
            disabled={disabled}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_CODES.map((country) => (
                <SelectItem key={`${country.code}-${country.country}`} value={country.code}>
                  {country.code} {country.country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        <Input
          id={field.id}
          type="tel"
          value={phoneNumber}
          onChange={handlePhoneChange}
          placeholder={field.placeholder || '(555) 123-4567'}
          disabled={disabled}
          className="flex-1"
        />
      </div>

      {displayError && (
        <p className="text-sm text-red-500">{displayError}</p>
      )}
    </div>
  );
}