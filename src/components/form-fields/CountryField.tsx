import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Country {
  code: string;
  name: string;
  flag: string;
}

interface CountryFieldProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function CountryField({ field, value, onChange, error, disabled = false }: CountryFieldProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const config = field.customConfig || {};
  const { defaultCountry, allowedCountries, preferred = [], showFlags = true, searchable = true } = config;

  // Fetch countries data from REST Countries API
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        setLoading(true);
        const response = await axios.get('https://restcountries.com/v3.1/all?fields=name,flags,cca2');
        const data = response.data.map((country: any) => ({
          name: country.name?.common || '',
          flag: country.flags?.svg || country.flags?.png || '',
          code: country.cca2 || '', // ISO Alpha-2 country code
        }));
        // Sort alphabetically by name
        const sortedData = data.sort((a: Country, b: Country) => a.name.localeCompare(b.name));
        setCountries(sortedData);
        setFetchError(null);
      } catch (err) {
        setFetchError('Failed to fetch countries');
        console.error('Error fetching countries:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCountries();
  }, []);

  // Get available countries based on configuration
  const getAvailableCountries = () => {
    let availableCountries = [...countries];
    
    // Filter by allowed countries if specified
    if (allowedCountries && allowedCountries.length > 0) {
      availableCountries = availableCountries.filter(country => 
        allowedCountries.includes(country.code)
      );
    }
    
    // Sort with preferred countries first
    if (preferred && preferred.length > 0) {
      const preferredCountries = availableCountries.filter(country => 
        preferred.includes(country.code)
      );
      const otherCountries = availableCountries.filter(country => 
        !preferred.includes(country.code)
      );
      availableCountries = [...preferredCountries, ...otherCountries];
    }
    
    return availableCountries;
  };

  const availableCountries = getAvailableCountries();
  const selectedCountry = availableCountries.find(country => country.code === value);

  // Set default country on mount
  useEffect(() => {
    if (!value && defaultCountry && countries.length > 0) {
      const defaultCountryData = availableCountries.find(country => country.code === defaultCountry);
      if (defaultCountryData) {
        onChange(defaultCountry);
      }
    }
  }, [value, defaultCountry, onChange, availableCountries, countries.length]);

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-2">
        <Label>{field.label}</Label>
        <Button
          variant="outline"
          disabled
          className="w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading countries...
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // Show error state
  if (fetchError) {
    return (
      <div className="space-y-2">
        <Label>{field.label}</Label>
        <Button
          variant="outline"
          disabled
          className="w-full justify-between text-red-600"
        >
          <span>{fetchError}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // If search is disabled, use a simple select fallback
  if (!searchable) {
    return (
      <div className="space-y-2">
        <Label>{field.label}</Label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        >
          <option value="">{field.placeholder || 'Select a country'}</option>
          {availableCountries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name} ({country.code})
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{field.label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between"
          >
            {selectedCountry ? (
              <span className="flex items-center gap-2">
                {showFlags && (
                  <img 
                    src={selectedCountry.flag} 
                    alt={`${selectedCountry.name} flag`} 
                    className="w-4 h-3 object-cover rounded-sm"
                  />
                )}
                {selectedCountry.name}
              </span>
            ) : (
              field.placeholder || 'Select a country'
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Search countries..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {availableCountries
                  .filter(country => 
                    country.name.toLowerCase().includes(searchValue.toLowerCase()) ||
                    country.code.toLowerCase().includes(searchValue.toLowerCase())
                  )
                  .map((country) => (
                    <CommandItem
                      key={country.code}
                      value={country.code}
                      onSelect={() => {
                        onChange(country.code);
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
                        {showFlags && (
                          <img 
                            src={country.flag} 
                            alt={`${country.name} flag`} 
                            className="w-4 h-3 object-cover rounded-sm"
                          />
                        )}
                        {country.name}
                        <span className="text-gray-500 text-sm">({country.code})</span>
                      </span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}