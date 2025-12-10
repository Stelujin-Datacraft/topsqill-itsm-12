
import React, { useState, useMemo, useEffect, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormFieldOption } from '@/types/conditions';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useGroups } from '@/hooks/useGroups';
import axios from 'axios';

interface Country {
  name: string;
  code: string;
  flag: string;
}

// Hook to fetch countries
const useCountries = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await axios.get('https://restcountries.com/v3.1/all?fields=name,flags,cca2');
        const data = response.data.map((country: any) => ({
          name: country.name?.common || '',
          code: country.cca2 || '',
          flag: country.flags?.svg || country.flags?.png || ''
        }));
        setCountries(data.sort((a: Country, b: Country) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error('Error fetching countries:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCountries();
  }, []);

  return { countries, loading };
};

// Phone country codes
const PHONE_COUNTRY_CODES = [
  { code: '+1', country: 'US/CA' },
  { code: '+44', country: 'UK' },
  { code: '+91', country: 'IN' },
  { code: '+86', country: 'CN' },
  { code: '+81', country: 'JP' },
  { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' },
  { code: '+61', country: 'AU' },
  { code: '+55', country: 'BR' },
  { code: '+7', country: 'RU' },
];

// Currency list
const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'INR', symbol: '₹' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CNY', symbol: '¥' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'CHF', symbol: 'Fr' },
  { code: 'AED', symbol: 'د.إ' },
];

interface DynamicValueInputProps {
  field: FormFieldOption;
  value: any;
  onChange: (value: any) => void;
}

export function DynamicValueInput({ field, value, onChange }: DynamicValueInputProps) {
  const normalizedType = (field.type || '').toLowerCase().replace(/[_\s]/g, '-');
  const { countries, loading: countriesLoading } = useCountries();
  const { users: orgUsers, loading: usersLoading } = useOrganizationUsers();
  const { groups: orgGroups, loading: groupsLoading } = useGroups();
  
  // State for tag input
  const [tagInput, setTagInput] = useState('');
  
  // Parse phone value
  const [phoneCountryCode, phoneNumber] = useMemo(() => {
    if (!value) return ['+1', ''];
    if (typeof value === 'string' && value.includes(' ')) {
      const parts = value.split(' ');
      return [parts[0], parts.slice(1).join(' ')];
    }
    return ['+1', value || ''];
  }, [value]);
  
  // Parse tags
  const tags = useMemo(() => {
    if (!value) return [];
    try {
      return Array.isArray(value) ? value : JSON.parse(value);
    } catch {
      return value ? String(value).split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    }
  }, [value]);
  
  // Parse multi-select values
  const selectedMultiValues = useMemo(() => {
    if (!value) return [];
    try {
      return Array.isArray(value) ? value : JSON.parse(value);
    } catch {
      return value ? [value] : [];
    }
  }, [value]);
  
  // Parse currency value
  const [currencyCode, currencyAmount] = useMemo(() => {
    if (!value) return ['USD', ''];
    try {
      const parsed = JSON.parse(value);
      return [parsed.currency || 'USD', String(parsed.amount || '')];
    } catch {
      return ['USD', value];
    }
  }, [value]);
  
  // Get slider config from field
  const sliderConfig = useMemo(() => {
    if (normalizedType === 'slider' || normalizedType === 'range') {
      const validation = field.validation as any || {};
      const customConfig = (field as any).custom_config || {};
      return {
        min: Number(validation.min ?? customConfig.min ?? 0),
        max: Number(validation.max ?? customConfig.max ?? 100),
        step: Number(validation.step ?? customConfig.step ?? 1)
      };
    }
    return null;
  }, [normalizedType, field]);

  // Get rating config from field
  const ratingConfig = useMemo(() => {
    if (normalizedType === 'rating' || normalizedType === 'star-rating' || normalizedType === 'starrating') {
      const customConfig = (field as any).custom_config || {};
      const validation = field.validation as any || {};
      return {
        max: Number(customConfig.maxRating ?? validation.max ?? 5)
      };
    }
    return null;
  }, [normalizedType, field]);

  // Get submission access options - ONLY show users/groups configured by admin
  const submissionAccessOptions = useMemo(() => {
    if (normalizedType === 'submission-access' || normalizedType === 'submissionaccess') {
      // Check all possible property names for custom config
      let rawConfig = (field as any).custom_config || (field as any).customConfig || (field as any).custom || {};
      
      // Parse JSON string if needed
      let config: any = {};
      if (typeof rawConfig === 'string') {
        try {
          config = JSON.parse(rawConfig);
        } catch {
          config = {};
        }
      } else {
        config = rawConfig;
      }
      
      const users: Array<{ value: string; label: string }> = [];
      const groups: Array<{ value: string; label: string }> = [];
      
      // Check for allowedUsers or allowedUserIds (different naming conventions)
      const allowedUserIds = config.allowedUsers || config.allowedUserIds || [];
      const allowedGroupIds = config.allowedGroups || config.allowedGroupIds || [];
      
      // Only add users that are explicitly configured
      if (Array.isArray(allowedUserIds) && allowedUserIds.length > 0 && orgUsers) {
        allowedUserIds.forEach((userId: string) => {
          const user = orgUsers.find(u => u.id === userId);
          if (user) {
            const label = `${user.first_name || ''} ${user.last_name || ''} (${user.email})`.trim();
            users.push({ value: `user:${user.email}`, label });
          }
        });
      }
      
      // Only add groups that are explicitly configured
      if (Array.isArray(allowedGroupIds) && allowedGroupIds.length > 0 && orgGroups) {
        allowedGroupIds.forEach((groupId: string) => {
          const group = orgGroups.find(g => g.id === groupId);
          if (group) {
            groups.push({ value: `group:${group.name}`, label: `Group: ${group.name}` });
          }
        });
      }
      
      // NO FALLBACK - if no config, show empty (no options configured)
      const hasConfig = allowedUserIds.length > 0 || allowedGroupIds.length > 0;
      
      return { users, groups, hasConfig };
    }
    return { users: [], groups: [], hasConfig: false };
  }, [normalizedType, field, orgUsers, orgGroups]);

  const hasOptions = Array.isArray(field.options) && field.options.length > 0;

  const renderInput = () => {
    // Date field
    if (normalizedType === 'date') {
      return (
        <Input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    // Time field
    if (normalizedType === 'time') {
      return (
        <Input
          type="time"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    // DateTime field
    if (normalizedType === 'datetime' || normalizedType === 'date-time' || normalizedType === 'datetime-local') {
      return (
        <Input
          type="datetime-local"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    // Phone field with country code
    if (normalizedType === 'phone' || normalizedType === 'phonenumber' || normalizedType === 'phone-number' || normalizedType === 'tel') {
      return (
        <div className="flex gap-2">
          <Select 
            value={phoneCountryCode} 
            onValueChange={(code) => onChange(phoneNumber ? `${code} ${phoneNumber}` : code)}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHONE_COUNTRY_CODES.map((c, idx) => (
                <SelectItem key={`${c.code}-${idx}`} value={c.code}>
                  {c.code} {c.country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="tel"
            value={phoneNumber}
            onChange={(e) => onChange(`${phoneCountryCode} ${e.target.value}`)}
            placeholder="Phone number"
            className="flex-1"
          />
        </div>
      );
    }

    // Toggle/Switch field
    if (normalizedType === 'toggle' || normalizedType === 'switch' || normalizedType === 'toggle-switch') {
      const isOn = value === 'true' || value === 'on' || value === 'yes' || value === '1' || value === true;
      return (
        <div className="flex items-center gap-3 p-2 border rounded-md bg-muted/30">
          <Switch
            checked={isOn}
            onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          />
          <span className="text-sm font-medium">{isOn ? 'On' : 'Off'}</span>
        </div>
      );
    }

    // Slider/Range field
    if (sliderConfig && (normalizedType === 'slider' || normalizedType === 'range')) {
      const numValue = Number(value) || sliderConfig.min;
      return (
        <div className="flex items-center gap-3">
          <Slider
            value={[numValue]}
            onValueChange={([v]) => onChange(String(v))}
            min={sliderConfig.min}
            max={sliderConfig.max}
            step={sliderConfig.step}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground w-10 text-right">{numValue}</span>
        </div>
      );
    }

    // Rating/Star field
    if (ratingConfig && (normalizedType === 'rating' || normalizedType === 'star-rating' || normalizedType === 'starrating')) {
      const numValue = Number(value) || 0;
      return (
        <div className="flex items-center gap-1">
          {Array.from({ length: ratingConfig.max }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(String(i + 1))}
              className="focus:outline-none"
            >
              <Star
                className={cn(
                  "h-5 w-5 transition-colors",
                  i < numValue ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                )}
              />
            </button>
          ))}
          <span className="text-sm ml-2 text-muted-foreground">{numValue}/{ratingConfig.max}</span>
        </div>
      );
    }

    // Yes/No field
    if (normalizedType === 'yes-no' || normalizedType === 'yesno') {
      return (
        <div className="flex gap-2">
          <Button
            type="button"
            variant={value === 'yes' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => onChange('yes')}
          >
            Yes
          </Button>
          <Button
            type="button"
            variant={value === 'no' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => onChange('no')}
          >
            No
          </Button>
        </div>
      );
    }

    // Country field
    if (normalizedType === 'country') {
      return (
        <Select value={value} onValueChange={onChange} disabled={countriesLoading}>
          <SelectTrigger>
            <SelectValue placeholder={countriesLoading ? "Loading..." : "Select country"} />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <div className="flex items-center gap-2">
                  {country.flag && <img src={country.flag} alt="" className="h-3 w-4 object-cover" />}
                  {country.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Submission access field - Multi-select for multiple users/groups
    if (normalizedType === 'submission-access' || normalizedType === 'submissionaccess') {
      if (usersLoading || groupsLoading) {
        return (
          <Select disabled>
            <SelectTrigger>
              <SelectValue placeholder="Loading..." />
            </SelectTrigger>
          </Select>
        );
      }

      const allOptions = [...submissionAccessOptions.users, ...submissionAccessOptions.groups];
      
      if (allOptions.length > 0) {
        // Parse selected values - support both array and comma-separated string
        let selectedValues: string[] = [];
        if (value) {
          if (Array.isArray(value)) {
            selectedValues = value;
          } else if (typeof value === 'string') {
            // Try to parse as JSON array first
            try {
              const parsed = JSON.parse(value);
              selectedValues = Array.isArray(parsed) ? parsed : [value];
            } catch {
              // Treat as comma-separated
              selectedValues = value.split(',').map(v => v.trim()).filter(Boolean);
            }
          }
        }
        
        return (
          <MultiSelect
            options={allOptions}
            selected={selectedValues}
            onChange={(selected) => onChange(selected)}
            placeholder="Select users or groups"
          />
        );
      }
      
      // No users/groups configured - show message
      return (
        <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
          No users/groups configured for this field. Please configure allowed users/groups in the field settings.
        </div>
      );
    }

    // Tags field
    if (normalizedType === 'tags' || normalizedType === 'tag') {
      const addTag = () => {
        const trimmed = tagInput.trim();
        if (trimmed && !tags.includes(trimmed)) {
          const newTags = [...tags, trimmed];
          onChange(JSON.stringify(newTags));
          setTagInput('');
        }
      };
      
      const removeTag = (index: number) => {
        const newTags = tags.filter((_: string, i: number) => i !== index);
        onChange(JSON.stringify(newTags));
      };
      
      const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          addTag();
        } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
          removeTag(tags.length - 1);
        }
      };
      
      return (
        <div className="space-y-2">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag: string, index: number) => (
                <Badge key={index} variant="secondary" className="px-2 py-1">
                  {tag}
                  <button type="button" onClick={() => removeTag(index)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <Input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            placeholder="Type and press Enter"
          />
        </div>
      );
    }

    // Currency field
    if (normalizedType === 'currency') {
      return (
        <div className="flex gap-2">
          <Select 
            value={currencyCode} 
            onValueChange={(code) => onChange(JSON.stringify({ currency: code, amount: parseFloat(currencyAmount) || 0 }))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.symbol} {c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={currencyAmount}
            onChange={(e) => onChange(JSON.stringify({ currency: currencyCode, amount: parseFloat(e.target.value) || 0 }))}
            placeholder="Amount"
            className="flex-1"
          />
        </div>
      );
    }

    // Multi-select field
    if ((normalizedType === 'multi-select' || normalizedType === 'multiselect') && hasOptions) {
      const toggleOption = (optValue: string) => {
        const newValues = selectedMultiValues.includes(optValue)
          ? selectedMultiValues.filter((v: string) => v !== optValue)
          : [...selectedMultiValues, optValue];
        onChange(JSON.stringify(newValues));
      };
      
      return (
        <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-2 bg-background">
          {field.options!.map((opt) => (
            <div key={opt.id} className="flex items-center gap-2">
              <Checkbox
                id={`multi-${opt.id}`}
                checked={selectedMultiValues.includes(opt.value)}
                onCheckedChange={() => toggleOption(opt.value)}
              />
              <label htmlFor={`multi-${opt.id}`} className="text-sm cursor-pointer">
                {opt.label || opt.value}
              </label>
            </div>
          ))}
        </div>
      );
    }

    // Checkbox field
    if (normalizedType === 'checkbox') {
      if (hasOptions) {
        return (
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select option" />
            </SelectTrigger>
            <SelectContent>
              {field.options!.filter(opt => opt.value && opt.value.trim() !== '').map((opt) => (
                <SelectItem key={opt.id} value={opt.value}>
                  {opt.label || opt.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      return (
        <div className="flex items-center gap-3 p-2 border rounded-md bg-muted/30">
          <Checkbox
            checked={value === true || value === 'true' || value === 'checked'}
            onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          />
          <span className="text-sm">{value === 'true' || value === 'checked' ? 'Checked' : 'Unchecked'}</span>
        </div>
      );
    }

    // Select/Radio/Dropdown field with options
    if ((normalizedType === 'select' || normalizedType === 'radio' || normalizedType === 'dropdown') && hasOptions) {
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            {field.options!.filter(opt => opt.value && opt.value.trim() !== '').map((opt) => (
              <SelectItem key={opt.id} value={opt.value}>
                {opt.label || opt.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Number field
    if (normalizedType === 'number') {
      return (
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter number"
        />
      );
    }

    // Email field
    if (normalizedType === 'email') {
      return (
        <Input
          type="email"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter email"
        />
      );
    }

    // URL field
    if (normalizedType === 'url' || normalizedType === 'website') {
      return (
        <Input
          type="url"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter URL"
        />
      );
    }

    // Textarea field
    if (normalizedType === 'textarea' || normalizedType === 'long-text' || normalizedType === 'longtext') {
      return (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter text"
          className="w-full min-h-[80px] p-2 border rounded-md text-sm"
        />
      );
    }

    // Default: text input
    return (
      <Input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter value"
      />
    );
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        Value for {field.label}
        <span className="text-xs text-muted-foreground ml-1">({field.type})</span>
      </Label>
      {renderInput()}
    </div>
  );
}
