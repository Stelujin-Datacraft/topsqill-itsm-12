
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FormField } from '@/types/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Search, ChevronDown, ChevronUp, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddressFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

interface CountryData {
  code: string;
  name: string;
  flag: string;
}


export function AddressField({ field, value = {}, onChange, error, disabled }: AddressFieldProps) {
  const config = field.customConfig || {};
  const enableGPS = config.enableGPS || false;
  const postalAutoFill = config.postalAutoFill || false;
  const addressFields = config.addressFields || ['street', 'city', 'state', 'postal', 'country'];
  
  const [addressData, setAddressData] = useState({
    street: '',
    city: '',
    state: '',
    postal: '',
    country: '',
    ...value,
  });

  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const countryContainerRef = useRef<HTMLDivElement>(null);
  
  // Track the previous value to prevent unnecessary updates
  const prevValueRef = useRef<string>('');

  // Fetch countries with flags from API
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        setCountriesLoading(true);
        const response = await axios.get('https://restcountries.com/v3.1/all?fields=name,flags,cca2');
        const data = response.data.map((c: any) => ({
          name: c.name?.common || '',
          flag: c.flags?.svg || c.flags?.png || '',
          code: c.cca2 || '',
        }));
        setCountries(data.sort((a: CountryData, b: CountryData) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error('Error fetching countries:', err);
      } finally {
        setCountriesLoading(false);
      }
    };
    fetchCountries();
  }, []);

  // Close country dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryContainerRef.current && !countryContainerRef.current.contains(event.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update addressData when value prop changes (for rule-based updates)
  useEffect(() => {
    // Serialize value for comparison to prevent infinite loops from object reference changes
    const valueString = JSON.stringify(value || {});
    
    // Only update if the serialized value actually changed
    if (valueString !== prevValueRef.current) {
      prevValueRef.current = valueString;
      
      if (value && typeof value === 'object' && Object.keys(value).length > 0) {
        setAddressData(prev => ({
          ...prev,
          ...value
        }));
      } else if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
        // Clear values when rule clears the field
        setAddressData({
          street: '',
          city: '',
          state: '',
          postal: '',
          country: ''
        });
      }
    }
  }, [value]);

  const handleFieldChange = (fieldName: string, fieldValue: string) => {
    const newData = { ...addressData, [fieldName]: fieldValue };
    setAddressData(newData);
    if (onChange) {
      onChange(newData);
    }
  };

  const handleGPSLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // In a real implementation, you would use a geocoding service
          // to convert coordinates to address
          console.log('GPS Location:', position.coords);
          // Mock auto-fill for demo
          const mockAddress = {
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            postal: '12345',
            country: 'US',
          };
          setAddressData(mockAddress);
          if (onChange) {
            onChange(mockAddress);
          }
        },
        (error) => {
          console.error('GPS Error:', error);
        }
      );
    }
  };

const selectedCountry = countries.find(
  (country) => country.code === addressData.country
);

  return (
    <>
      <div className="flex items-center justify-between">
        {/* <Label>{field.label}</Label> */}
          <Label htmlFor={`${field.id}-street`}>Street Address</Label>
        {enableGPS && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGPSLocation}
            disabled={disabled}
          >
            <MapPin className="h-4 w-4 mr-2" />
            Use Current Location
          </Button>
        )}
      </div>

      {addressFields.includes('street') && (
        <div className="mt-3">
          <Input
            id={`${field.id}-street`}
            value={addressData.street}
            onChange={(e) => handleFieldChange('street', e.target.value)}
            disabled={disabled}
            placeholder="Enter street address"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mt-3">
        {addressFields.includes('city') && (
          <div>
            <Label htmlFor={`${field.id}-city`}>City</Label>
            <Input
              id={`${field.id}-city`}
              value={addressData.city}
              onChange={(e) => handleFieldChange('city', e.target.value)}
              disabled={disabled}
              placeholder="Enter city"
            />
          </div>
        )}

        {addressFields.includes('state') && (
          <div>
            <Label htmlFor={`${field.id}-state`}>State/Province</Label>
            <Input
              id={`${field.id}-state`}
              value={addressData.state}
              onChange={(e) => handleFieldChange('state', e.target.value)}
              disabled={disabled}
              placeholder="Enter state"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mt-3">
        {addressFields.includes('postal') && (
          <div>
            <Label htmlFor={`${field.id}-postal`}>Postal/ZIP Code</Label>
            <Input
              id={`${field.id}-postal`}
              value={addressData.postal}
              onChange={(e) => handleFieldChange('postal', e.target.value)}
              disabled={disabled}
              placeholder="Enter postal code"
            />
          </div>
        )}
{addressFields.includes('country') && (
  <div ref={countryContainerRef} className="relative">
    <Label htmlFor={`${field.id}-country`}>Country</Label>
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={countryOpen}
      className="w-full justify-between"
      disabled={disabled || countriesLoading}
      onClick={() => setCountryOpen(!countryOpen)}
      type="button"
    >
      {countriesLoading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </span>
      ) : selectedCountry ? (
        <span className="flex items-center gap-2">
          <img src={selectedCountry.flag} alt="" className="w-4 h-3 object-cover rounded-sm" />
          {selectedCountry.name}
        </span>
      ) : (
        "Select country..."
      )}
      {countryOpen ? (
        <ChevronUp className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      ) : (
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      )}
    </Button>

    {countryOpen && (
      <div className="absolute z-50 w-full mt-1 border border-input bg-popover rounded-md shadow-md">
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search countries..."
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              className="pl-8 h-8"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto">
          <div className="p-1">
            {countries
              .filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.toLowerCase().includes(countrySearch.toLowerCase()))
              .map((country) => (
                <button
                  key={country.code}
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-sm hover:bg-accent transition-colors text-sm",
                    selectedCountry?.code === country.code && "bg-accent"
                  )}
                  onClick={() => {
                    handleFieldChange("country", country.code);
                    setCountryOpen(false);
                    setCountrySearch('');
                  }}
                >
                  <Check className={cn("h-4 w-4 shrink-0", selectedCountry?.code === country.code ? "opacity-100" : "opacity-0")} />
                  <img src={country.flag} alt="" className="w-4 h-3 object-cover rounded-sm" />
                  {country.name}
                  <span className="text-muted-foreground text-xs ml-auto">({country.code})</span>
                </button>
              ))}
          </div>
        </ScrollArea>
      </div>
    )}
  </div>
)}

      </div>

      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </>
  );
}
