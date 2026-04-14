
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, ChevronDown, ChevronUp, Loader2, Search } from 'lucide-react';
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
  const containerRef = useRef<HTMLDivElement>(null);

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
          code: country.cca2 || '',
        }));
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getAvailableCountries = () => {
    let availableCountries = [...countries];
    if (allowedCountries && allowedCountries.length > 0) {
      availableCountries = availableCountries.filter(country => allowedCountries.includes(country.code));
    }
    if (preferred && preferred.length > 0) {
      const preferredCountries = availableCountries.filter(country => preferred.includes(country.code));
      const otherCountries = availableCountries.filter(country => !preferred.includes(country.code));
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

  if (loading) {
    return (
      <>
        <Button variant="outline" disabled className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading countries...
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {error && <p className="text-sm text-destructive mt-1">{error}</p>}
      </>
    );
  }

  if (fetchError) {
    return (
      <>
        <Label>{field.label}</Label>
        <Button variant="outline" disabled className="w-full justify-between text-destructive">
          <span>{fetchError}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {error && <p className="text-sm text-destructive mt-1">{error}</p>}
      </>
    );
  }

  if (!searchable) {
    return (
      <>
        <Label>{field.label}</Label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{field.placeholder || 'Select a country'}</option>
          {availableCountries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name} ({country.code})
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-destructive mt-1">{error}</p>}
      </>
    );
  }

  const filteredCountries = availableCountries.filter(country =>
    country.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    country.code.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className="w-full justify-between"
        onClick={() => setOpen(!open)}
        type="button"
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
        {open ? (
          <ChevronUp className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        ) : (
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        )}
      </Button>

      {open && (
        <div className="absolute z-50 w-full mt-1 border border-input bg-popover rounded-md shadow-md">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search countries..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-8 h-8"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredCountries.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">No country found.</div>
            ) : (
              <div className="p-1">
                {filteredCountries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-sm hover:bg-accent transition-colors text-sm",
                      value === country.code && "bg-accent"
                    )}
                    onClick={() => {
                      onChange(country.code);
                      setOpen(false);
                      setSearchValue('');
                    }}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        value === country.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {showFlags && (
                      <img
                        src={country.flag}
                        alt={`${country.name} flag`}
                        className="w-4 h-3 object-cover rounded-sm"
                      />
                    )}
                    {country.name}
                    <span className="text-muted-foreground text-xs ml-auto">({country.code})</span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}
