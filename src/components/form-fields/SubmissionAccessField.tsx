
import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronDown, X, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';

interface SubmissionAccessFieldProps {
  field: FormField;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  error?: string;
  disabled?: boolean;
}

export function SubmissionAccessField({ field, value, onChange, error, disabled }: SubmissionAccessFieldProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const { users, loading, searchUsers } = useOrganizationUsers();

  const config = field.customConfig || {};
  const allowMultiple = config.allowMultiple || false;
  
  // Normalize value to array for easier handling
  const selectedUserIds = Array.isArray(value) ? value : (value ? [value] : []);
  
  // Transform users to include name property and filter based on search
  const transformedUsers = (users || []).map(user => ({
    id: user.id,
    name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
    email: user.email,
    role: user.role
  }));

  const filteredUsers = searchValue
    ? transformedUsers.filter(user =>
        user.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        user.email.toLowerCase().includes(searchValue.toLowerCase()) ||
        user.role.toLowerCase().includes(searchValue.toLowerCase())
      )
    : transformedUsers;

  const selectedUsers = transformedUsers.filter(user => selectedUserIds.includes(user.id));

  const handleUserSelect = (userId: string) => {
    if (allowMultiple) {
      let newValue = [...selectedUserIds];
      if (newValue.includes(userId)) {
        newValue = newValue.filter(id => id !== userId);
      } else {
        newValue.push(userId);
      }
      onChange(newValue);
    } else {
      onChange(selectedUserIds.includes(userId) ? '' : userId);
      setOpen(false);
    }
    setSearchValue('');
  };

  const handleUserRemove = (userId: string) => {
    if (allowMultiple) {
      const newValue = selectedUserIds.filter(id => id !== userId);
      onChange(newValue);
    } else {
      onChange('');
    }
  };

  const getAccessLevelBadge = () => {
    const level = config.accessLevel || 'view';
    const colors = {
      view: 'bg-blue-100 text-blue-800',
      edit: 'bg-green-100 text-green-800',
      admin: 'bg-red-100 text-red-800'
    };
    return (
      <Badge className={colors[level as keyof typeof colors]}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor={field.id}>{field.label}</Label>
        {getAccessLevelBadge()}
      </div>
      
      {/* Selected users display */}
      {selectedUsers.length > 0 && (
        <div className="space-y-2">
          {selectedUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <div>
                  <span className="font-medium">{user.name}</span>
                  <span className="text-sm text-gray-500 ml-2">({user.email})</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {user.role}
                  </Badge>
                </div>
              </div>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUserRemove(user.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* User selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedUsers.length > 0 ? (
              allowMultiple ? 
                `${selectedUsers.length} user(s) selected` :
                selectedUsers[0].name
            ) : (
              field.placeholder || "Select user(s)..."
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-500">
              Loading users...
            </div>
          ) : (
            <Command>
              <CommandInput 
                placeholder="Search users..." 
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandEmpty>No users found.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-y-auto">
                {(filteredUsers || []).map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={() => handleUserSelect(user.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedUserIds.includes(user.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <Users className="h-4 w-4 text-gray-500" />
                      <div className="flex-1">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {user.role}
                      </Badge>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          )}
        </PopoverContent>
      </Popover>

      {/* Configuration info */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>Access Level: {config.accessLevel || 'view'}</p>
        {config.accessDuration && (
          <p>Duration: {config.accessDuration} days</p>
        )}
        {config.requireConfirmation && (
          <p>⚠️ User confirmation required</p>
        )}
        {config.sendNotification !== false && (
          <p>📧 Email notification will be sent</p>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
