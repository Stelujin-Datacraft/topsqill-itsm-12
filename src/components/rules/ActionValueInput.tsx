import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FormField } from '@/types/form';
import { FieldRuleAction } from '@/types/rules';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, ChevronDown, X, Users, Loader2, Upload, Phone, ChevronsUpDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const [isCountryOpen, setIsCountryOpen] = useState(false);
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

    // Select/Radio fields (single selection)
    if (['select', 'radio'].includes(targetField.type) && targetField.options) {
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

    // Multi-select field (multiple selection with checkboxes)
    if (targetField.type === 'multi-select' && targetField.options) {
      const currentValues = Array.isArray(value) ? value : [];
      const handleOptionToggle = (optionValue: string) => {
        const newValues = currentValues.includes(optionValue)
          ? currentValues.filter(v => v !== optionValue)
          : [...currentValues, optionValue];
        onChange(newValues);
      };

      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Select multiple values:</Label>
          <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
            {targetField.options.filter((option: any) => option.value && option.value.trim() !== '').map((option: any) => (
              <div key={option.id || option.value} className="flex items-center space-x-2">
                <Checkbox
                  checked={currentValues.includes(option.value)}
                  onCheckedChange={() => handleOptionToggle(option.value)}
                />
                <Label className="text-sm cursor-pointer flex-1">
                  {option.label || option.value}
                </Label>
              </div>
            ))}
          </div>
          {currentValues.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Selected: {currentValues.join(', ')}
            </div>
          )}
        </div>
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

    // Checkbox field
    if (targetField.type === 'checkbox') {
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={value === true || value === 'true'}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <Label className="text-sm">
            {value === true || value === 'true' ? 'Checked' : 'Unchecked'}
          </Label>
        </div>
      );
    }

    // Toggle Switch field
    if (targetField.type === 'toggle-switch') {
      return (
        <div className="flex items-center space-x-2">
          <Switch
            checked={value === true || value === 'true'}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <Label className="text-sm">
            {value === true || value === 'true' ? 'On' : 'Off'}
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
      const phoneValue = typeof value === 'object' ? value : { number: value || '', countryCode: '+1' };
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Phone Number:</Label>
          <div className="flex space-x-2">
            <Select
              value={phoneValue.countryCode || '+1'}
              onValueChange={(countryCode) => onChange({ ...phoneValue, countryCode })}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="+1">🇺🇸 +1</SelectItem>
                <SelectItem value="+44">🇬🇧 +44</SelectItem>
                <SelectItem value="+33">🇫🇷 +33</SelectItem>
                <SelectItem value="+49">🇩🇪 +49</SelectItem>
                <SelectItem value="+81">🇯🇵 +81</SelectItem>
                <SelectItem value="+86">🇨🇳 +86</SelectItem>
                <SelectItem value="+91">🇮🇳 +91</SelectItem>
                <SelectItem value="+61">🇦🇺 +61</SelectItem>
                <SelectItem value="+55">🇧🇷 +55</SelectItem>
                <SelectItem value="+7">🇷🇺 +7</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="tel"
              value={phoneValue.number || ''}
              onChange={(e) => onChange({ ...phoneValue, number: e.target.value })}
              placeholder="Phone number"
              className="flex-1"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Full number: {phoneValue.countryCode}{phoneValue.number}
          </div>
        </div>
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
            <Popover open={isCountryOpen} onOpenChange={setIsCountryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isCountryOpen}
                  className="justify-between"
                >
                  {addressValue.country 
                    ? countries.find(country => country.code === addressValue.country)?.name || addressValue.country
                    : "Select country..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0">
                <Command>
                  <CommandInput placeholder="Search country..." />
                  <CommandEmpty>No country found.</CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-[200px]">
                      {countries.map((country) => (
                        <CommandItem
                          key={country.code}
                          value={country.name}
                          onSelect={() => {
                            onChange({ ...addressValue, country: country.code });
                            setIsCountryOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              addressValue.country === country.code ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          <span className="mr-2">{country.flag}</span>
                          {country.name}
                        </CommandItem>
                      ))}
                    </ScrollArea>
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
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

    // File field
    if (targetField.type === 'file') {
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Default File Message:</Label>
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter message about default file (e.g., 'Default template.pdf')"
          />
          <div className="flex items-center space-x-2 p-3 border-2 border-dashed border-muted-foreground/25 rounded-md">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              File upload defaults cannot be set through rules. Users must upload files during form submission.
            </span>
          </div>
        </div>
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