import React, { useState, useEffect, useMemo } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, ChevronDown, X, Users } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectMembership } from '@/hooks/useProjectMembership';
import { useRoles } from '@/hooks/useRoles';
import { cn } from '@/lib/utils';

interface UserPickerFieldProps {
  field: FormField;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  error?: string;
  disabled?: boolean;
}

export function UserPickerField({ field, value, onChange, error, disabled }: UserPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { currentProject } = useProject();
  const { projectMembers, loading } = useProjectMembership(currentProject?.id || '');
  const { roles } = useRoles();
  
  // Debug logging
  useEffect(() => {
    console.log('🔍 UserPickerField Debug Info:');
    console.log('Current Project ID:', currentProject?.id);
    console.log('Project Members:', projectMembers);
    console.log('Loading:', loading);
  }, [currentProject?.id, projectMembers, loading]);
  
  const config = field.customConfig || {};
  const isMultiple = config.allowMultiple || config.maxSelections > 1;
  const maxSelections = config.maxSelections || 1;

  // Filter users based on configuration
  const filteredUsers = useMemo(() => {
    let users = projectMembers || [];
    
    // Apply admin pre-selection filter
    if ((config as any).allowedUsers && (config as any).allowedUsers.length > 0) {
      users = users.filter(user => (config as any).allowedUsers.includes(user.user_id));
    }
    
    // Apply role filter if specified
    if (config.roleFilter) {
      users = users.filter(user => user.role === config.roleFilter);
    }
    
    // Apply search filter
    if (searchTerm) {
      users = users.filter(user => 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return users;
  }, [projectMembers, (config as any)?.allowedUsers, config.roleFilter, searchTerm]);

  // Convert value to array for easier handling
  const selectedUserIds = useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  const selectedUsers = useMemo(() => {
    return (projectMembers || []).filter(user => selectedUserIds.includes(user.user_id));
  }, [projectMembers, selectedUserIds]);

  const handleUserSelect = (userId: string) => {
    if (disabled) return;

    if (isMultiple) {
      const currentSelection = Array.isArray(value) ? value : (value ? [value] : []);
      
      if (currentSelection.includes(userId)) {
        // Remove user
        const newSelection = currentSelection.filter(id => id !== userId);
        onChange(newSelection);
      } else {
        // Add user (respect max selections)
        if (currentSelection.length < maxSelections) {
          onChange([...currentSelection, userId]);
        }
      }
    } else {
      // Single selection
      onChange(userId === value ? '' : userId);
      setOpen(false);
    }
  };

  const removeUser = (userId: string) => {
    if (disabled) return;
    
    if (isMultiple) {
      const currentSelection = Array.isArray(value) ? value : [];
      onChange(currentSelection.filter(id => id !== userId));
    } else {
      onChange('');
    }
  };

  const getUserDisplayName = (user: any) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email;
  };

  const getUserInitials = (user: any) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>{field.label}</Label>
      
      {/* Selected Users Display */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedUsers.map((user) => (
            <Badge key={user.user_id} variant="secondary" className="flex items-center gap-2 px-3 py-1">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-xs">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{getUserDisplayName(user)}</span>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => removeUser(user.user_id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* User Selection Popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || (isMultiple && selectedUserIds.length >= maxSelections)}
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {selectedUsers.length === 0 ? (
                <span className="text-muted-foreground">
                  {field.placeholder || `Select ${isMultiple ? 'users' : 'user'}...`}
                </span>
              ) : (
                <span>
                  {isMultiple 
                    ? `${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''} selected`
                    : getUserDisplayName(selectedUsers[0])
                  }
                </span>
              )}
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
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
                {filteredUsers.map((user) => {
                  const isSelected = selectedUserIds.includes(user.user_id);
                  return (
                    <CommandItem
                      key={user.user_id}
                      value={user.user_id}
                      onSelect={() => handleUserSelect(user.user_id)}
                      className="flex items-center gap-3"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {getUserInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{getUserDisplayName(user)}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {user.email}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {user.role}
                        </Badge>
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Role Assignment Info */}
      {config.assignRole && (
        <div className="text-sm text-muted-foreground">
          Selected users will be assigned the role: <Badge variant="outline">
            {roles.find(role => role.id === config.assignRole)?.name || config.assignRole}
          </Badge>
        </div>
      )}

      {/* Selection Limit Info */}
      {isMultiple && maxSelections > 1 && (
        <div className="text-sm text-muted-foreground">
          You can select up to {maxSelections} users. Currently selected: {selectedUserIds.length}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}