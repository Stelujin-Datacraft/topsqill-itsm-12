
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
  
  // Track the previous value to prevent unnecessary updates
  const prevValueRef = useRef<string>('');

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

const selectedCountry = COUNTRIES.find(
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
  <div>
    <Label htmlFor={`${field.id}-country`}>Country</Label>

    <Popover open={countryOpen} onOpenChange={setCountryOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={countryOpen}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedCountry ? selectedCountry.name : "Select country..."}
          <svg
            className="ml-2 h-4 w-4 opacity-50"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06-.02L10 10.584l3.71-3.4a.75.75 0 111.02 1.1l-4.2 3.847a.75.75 0 01-1.02 0L5.25 8.29a.75.75 0 01-.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </Button>
      </PopoverTrigger>

<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
  <div className="max-h-60 overflow-auto">
    {COUNTRIES.map((country) => (
      <button
        key={country.code}
        type="button"
        className={`w-full px-3 py-2 text-left hover:bg-accent/40 ${
          selectedCountry?.code === country.code ? "bg-accent/20" : ""
        }`}
        onClick={() => {
          handleFieldChange("country", country.code);
          setCountryOpen(false);
        }}
      >
        <span className="text-sm">{country.name}</span>
      </button>
    ))}
  </div>
</PopoverContent>

    </Popover>
  </div>
)}

      </div>

      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </>
  );
}
