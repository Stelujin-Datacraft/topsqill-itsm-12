import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FormField } from '@/types/form';
import { FieldRuleAction } from '@/types/rules';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, ChevronDown, X, Users, Loader2 } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectMembership } from '@/hooks/useProjectMembership';
import { cn } from '@/lib/utils';

interface Country {
  code: string;
  name: string;
  flag: string;
}

interface ActionValueInputProps {
  action: FieldRuleAction;
  targetField: FormField | null;
  value: any;
  onChange: (value: any) => void;
}

export function ActionValueInput({ action, targetField, value, onChange }: ActionValueInputProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const { currentProject } = useProject();
  const { projectMembers, loading } = useProjectMembership(currentProject?.id || '');

  // Fetch countries for country field types
  useEffect(() => {
    if (targetField?.type === 'country' && action === 'setDefault') {
      const fetchCountries = async () => {
        try {
          setCountriesLoading(true);
          const response = await axios.get('https://restcountries.com/v3.1/all?fields=name,flags,cca2');
          const data = response.data.map((country: any) => ({
            name: country.name?.common || '',
            flag: country.flags?.svg || country.flags?.png || '',
            code: country.cca2 || '',
          }));
          const sortedData = data.sort((a: Country, b: Country) => a.name.localeCompare(b.name));
          setCountries(sortedData);
        } catch (err) {
          console.error('Error fetching countries:', err);
        } finally {
          setCountriesLoading(false);
        }
      };

      fetchCountries();
    }
  }, [targetField?.type, action]);

  // Don't show input for actions that don't need values
  if (!['setDefault', 'changeLabel', 'showTooltip', 'showError', 'changeOptions'].includes(action)) {
    return null;
  }

  // Handle changeOptions action with textarea
  if (action === 'changeOptions') {
    return (
      <div className="space-y-2">
        <textarea
          className="w-full p-2 border rounded min-h-[80px] text-sm"
          value={Array.isArray(value) ? value.join('\n') : value?.toString() || ''}
          onChange={(e) => {
            const lines = e.target.value.split('\n').filter(line => line.trim());
            onChange(lines);
          }}
          placeholder="Option 1&#10;Option 2&#10;Option 3"
        />
        <p className="text-xs text-muted-foreground">Enter one option per line</p>
      </div>
    );
  }

  // Handle setDefault action based on target field type
  if (action === 'setDefault' && targetField) {
    // User picker field
    if (targetField.type === 'user-picker') {
      const config = targetField.customConfig || {};
      const isMultiple = config.allowMultiple || config.maxSelections > 1;
      const selectedUserIds = Array.isArray(value) ? value : (value ? [value] : []);

      const filteredUsers = projectMembers?.filter(user => {
        if (config.roleFilter) {
          return user.role === config.roleFilter;
        }
        return true;
      }).filter(user => 
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
      ) || [];

      const handleUserSelect = (userId: string) => {
        if (isMultiple) {
          const newSelection = selectedUserIds.includes(userId)
            ? selectedUserIds.filter(id => id !== userId)
            : [...selectedUserIds, userId];
          onChange(newSelection);
        } else {
          onChange(userId);
          setOpen(false);
        }
      };

      const removeUser = (userId: string) => {
        if (isMultiple) {
          onChange(selectedUserIds.filter(id => id !== userId));
        } else {
          onChange('');
        }
      };

      const getUserDisplayName = (user: any) => {
        return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
      };

      const getUserInitials = (user: any) => {
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?';
      };

      return (
        <div className="space-y-2">
          {/* Selected users */}
          {selectedUserIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUserIds.map(userId => {
                const user = projectMembers?.find(u => u.user_id === userId);
                if (!user) return null;
                return (
                  <Badge key={userId} variant="secondary" className="flex items-center gap-2">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-xs">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{getUserDisplayName(user)}</span>
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeUser(userId)}
                    />
                  </Badge>
                );
              })}
            </div>
          )}

          {/* User selection */}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between"
                disabled={loading}
              >
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {selectedUserIds.length === 0 
                    ? "Select users..." 
                    : `${selectedUserIds.length} user${selectedUserIds.length > 1 ? 's' : ''} selected`
                  }
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput 
                  placeholder="Search users..." 
                  value={searchTerm}
                  onValueChange={setSearchTerm}
                />
                <CommandList>
                  <CommandEmpty>
                    {loading ? "Loading users..." : "No users found."}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredUsers.map((user) => (
                      <CommandItem
                        key={user.user_id}
                        value={user.email}
                        onSelect={() => handleUserSelect(user.user_id)}
                        className="flex items-center gap-2"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedUserIds.includes(user.user_id) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {getUserInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm">{getUserDisplayName(user)}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      );
    }

    // Country field
    if (targetField.type === 'country') {
      const selectedCountry = countries.find(c => c.code === value || c.name === value);

      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
              disabled={countriesLoading}
            >
              {selectedCountry ? (
                <div className="flex items-center gap-2">
                  <img src={selectedCountry.flag} alt="" className="h-4 w-6 object-cover rounded-sm" />
                  <span>{selectedCountry.name}</span>
                </div>
              ) : countriesLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading countries...</span>
                </div>
              ) : (
                <span>Select country...</span>
              )}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder="Search countries..." />
              <CommandList>
                <CommandEmpty>
                  {countriesLoading ? "Loading countries..." : "No countries found."}
                </CommandEmpty>
                <CommandGroup>
                  {countries.map((country) => (
                    <CommandItem
                      key={country.code}
                      value={country.name}
                      onSelect={() => {
                        onChange(country.code);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === country.code || value === country.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <img src={country.flag} alt="" className="h-4 w-6 object-cover rounded-sm" />
                      <span>{country.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      );
    }

    // Select/Radio/Dropdown fields
    if (['select', 'radio', 'multi-select'].includes(targetField.type) && targetField.options) {
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            {targetField.options.filter((option: any) => option.value && option.value.trim() !== '').map((option: any) => (
              <SelectItem key={option.id || option.value} value={option.value}>
                {option.label || option.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Email field
    if (targetField.type === 'email') {
      return (
        <Input
          type="email"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter email address"
        />
      );
    }

    // Number field
    if (targetField.type === 'number') {
      return (
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter number"
        />
      );
    }

    // Date field
    if (targetField.type === 'date') {
      return (
        <Input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    // Time field
    if (targetField.type === 'time') {
      return (
        <Input
          type="time"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    // DateTime field
    if (targetField.type === 'datetime') {
      return (
        <Input
          type="datetime-local"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    // Checkbox/Toggle field
    if (targetField.type === 'checkbox' || targetField.type === 'toggle-switch') {
      return (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={value === true || value === 'true'}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded"
          />
          <Label className="text-sm">
            {value === true || value === 'true' ? 'Checked' : 'Unchecked'}
          </Label>
        </div>
      );
    }

    // Slider field
    if (targetField.type === 'slider') {
      const min = targetField.validation?.min || 0;
      const max = targetField.validation?.max || 100;
      return (
        <div className="space-y-2">
          <input
            type="range"
            min={min}
            max={max}
            value={value || min}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-sm text-center">Value: {value || min}</div>
        </div>
      );
    }

    // Rating field
    if (targetField.type === 'rating') {
      const config = targetField.customConfig as any || {};
      const maxRating = config.maxRating || 5;
      return (
        <div className="space-y-2">
          <Input
            type="number"
            min={1}
            max={maxRating}
            value={value || ''}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={`Rating (1-${maxRating})`}
          />
        </div>
      );
    }

    // Tags field
    if (targetField.type === 'tags') {
      const tagsArray = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          <textarea
            className="w-full p-2 border rounded min-h-[60px] text-sm"
            value={tagsArray.join(', ')}
            onChange={(e) => {
              const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
              onChange(tags);
            }}
            placeholder="Enter tags separated by commas"
          />
          <p className="text-xs text-muted-foreground">Separate tags with commas</p>
        </div>
      );
    }

    // Currency field
    if (targetField.type === 'currency') {
      const currencyValue = typeof value === 'object' ? value : { amount: 0, currency: 'USD' };
      return (
        <div className="space-y-2">
          <Input
            type="number"
            step="0.01"
            value={currencyValue.amount || ''}
            onChange={(e) => onChange({ ...currencyValue, amount: Number(e.target.value) })}
            placeholder="Amount"
          />
          <Select
            value={currencyValue.currency || 'USD'}
            onValueChange={(currency) => onChange({ ...currencyValue, currency })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="GBP">GBP (£)</SelectItem>
              <SelectItem value="JPY">JPY (¥)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Phone field
    if (targetField.type === 'phone') {
      return (
        <Input
          type="tel"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter phone number"
        />
      );
    }

    // Address field
    if (targetField.type === 'address') {
      const addressValue = typeof value === 'object' ? value : {};
      return (
        <div className="space-y-2">
          <Input
            value={addressValue.street || ''}
            onChange={(e) => onChange({ ...addressValue, street: e.target.value })}
            placeholder="Street Address"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={addressValue.city || ''}
              onChange={(e) => onChange({ ...addressValue, city: e.target.value })}
              placeholder="City"
            />
            <Input
              value={addressValue.state || ''}
              onChange={(e) => onChange({ ...addressValue, state: e.target.value })}
              placeholder="State"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={addressValue.postal || ''}
              onChange={(e) => onChange({ ...addressValue, postal: e.target.value })}
              placeholder="Postal Code"
            />
            <Input
              value={addressValue.country || ''}
              onChange={(e) => onChange({ ...addressValue, country: e.target.value })}
              placeholder="Country"
            />
          </div>
        </div>
      );
    }

    // Signature field
    if (targetField.type === 'signature') {
      return (
        <div className="space-y-2">
          <div className="p-4 border-2 border-dashed border-muted-foreground/25 rounded-md text-center">
            <p className="text-sm text-muted-foreground">
              Signature fields cannot have default values in rules.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Signatures must be created by users during form submission.
            </p>
          </div>
        </div>
      );
    }

    // Barcode field
    if (targetField.type === 'barcode') {
      return (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter barcode value"
        />
      );
    }

    // Submission access field
    if (targetField.type === 'submission-access') {
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select access level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="private">Private</SelectItem>
            <SelectItem value="restricted">Restricted</SelectItem>
          </SelectContent>
        </Select>
      );
    }
  }

  // Default input for other actions
  return (
    <Input
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        action === 'changeLabel' ? 'New label text' :
        action === 'setDefault' ? 'Default value' :
        action === 'showTooltip' ? 'Tooltip text' :
        action === 'showError' ? 'Error message' :
        'Enter action value'
      }
    />
  );
}