
import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Comprehensive country list
const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  // Add more countries as needed
];

interface CountryFieldProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function CountryField({ field, value, onChange, error, disabled }: CountryFieldProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [fallbackMode, setFallbackMode] = useState(false);

  const config = field.customConfig || {};
  
  // Filter countries based on configuration
  const getAvailableCountries = () => {
    let countries = [...COUNTRIES];
    
    // Filter by allowed countries
    if (config.allowedCountries && config.allowedCountries.length > 0) {
      countries = countries.filter(country => 
        config.allowedCountries.includes(country.code)
      );
    }
    
    // Sort with preferred countries first
    if (config.preferred && config.preferred.length > 0) {
      const preferred = countries.filter(country => 
        config.preferred.includes(country.code)
      );
      const others = countries.filter(country => 
        !config.preferred.includes(country.code)
      );
      countries = [...preferred, ...others];
    }
    
    return countries;
  };

  const availableCountries = getAvailableCountries();
  
  // Filter countries based on search
  const filteredCountries = searchValue
    ? availableCountries.filter(country =>
        country.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        country.code.toLowerCase().includes(searchValue.toLowerCase())
      )
    : availableCountries;

  const selectedCountry = availableCountries.find(country => country.code === value);

  // Set default country if specified
  useEffect(() => {
    if (!value && config.defaultCountry) {
      const defaultCountry = availableCountries.find(country => 
        country.code === config.defaultCountry
      );
      if (defaultCountry) {
        onChange(defaultCountry.code);
      }
    }
  }, [config.defaultCountry, value, onChange, availableCountries]);

  return (
    <div className="space-y-3">
      <Label htmlFor={field.id}>{field.label}</Label>
      
      {config.searchable !== false && !fallbackMode ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
              disabled={disabled}
              onClick={() => {
                try {
                  setOpen(!open);
                } catch (error) {
                  console.error('Country selector error, switching to fallback mode:', error);
                  setFallbackMode(true);
                }
              }}
            >
              {selectedCountry ? (
                <span className="flex items-center gap-2">
                  {config.showFlags !== false && selectedCountry.flag}
                  {selectedCountry.name}
                </span>
              ) : (
                field.placeholder || "Select country..."
              )}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0 z-50 bg-background border shadow-md">
            <Command>
              <CommandInput 
                placeholder="Search countries..." 
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-y-auto">
                {filteredCountries.map((country) => (
                  <CommandItem
                    key={country.code}
                    value={country.code}
                    onSelect={(currentValue) => {
                      onChange(currentValue);
                      setOpen(false);
                      setSearchValue('');
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === country.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex items-center gap-2">
                      {config.showFlags !== false && country.flag}
                      {country.name}
                      <span className="text-gray-500 text-sm">({country.code})</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        // Simple select dropdown when search is disabled
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
        >
          <option value="">{field.placeholder || "Select country..."}</option>
          {availableCountries.map((country) => (
            <option key={country.code} value={country.code}>
              {config.showFlags !== false ? `${country.flag} ` : ''}{country.name}
            </option>
          ))}
        </select>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
