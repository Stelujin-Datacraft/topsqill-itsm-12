import React, { useState, useMemo } from 'react';
import { FormField } from '@/types/form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronDown, X, Users, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useGroups } from '@/hooks/useGroups';
import { cn } from '@/lib/utils';

interface SubmissionAccessInputProps {
  targetField: FormField;
  value: any;
  onChange: (value: any) => void;
}

export function SubmissionAccessInput({ targetField, value, onChange }: SubmissionAccessInputProps) {
  const [open, setOpen] = useState(false);
  const { users, loading: usersLoading } = useOrganizationUsers();
  const { groups, loading: groupsLoading } = useGroups();

  const customConfig = targetField.customConfig as any || {};
  const allowedUsers = customConfig.allowedUsers || [];
  const allowedGroups = customConfig.allowedGroups || [];
  const allowMultiple = customConfig.allowMultiple !== false;

  // Filter users and groups to only those allowed by the field configuration
  const filteredUsers = useMemo(() => 
    users.filter(user => allowedUsers.includes(user.id)),
    [users, allowedUsers]
  );
  
  const filteredGroups = useMemo(() =>
    groups.filter(group => allowedGroups.includes(group.id)),
    [groups, allowedGroups]
  );

  // Parse current value
  const normalizedValue = useMemo(() => {
    if (!value) return { users: [], groups: [] };
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return { users: [], groups: [] };
      }
    }
    return value;
  }, [value]);

  const selectedUsers = normalizedValue.users || [];
  const selectedGroups = normalizedValue.groups || [];

  const handleUserToggle = (userId: string) => {
    const newUsers = selectedUsers.includes(userId)
      ? selectedUsers.filter((id: string) => id !== userId)
      : allowMultiple 
        ? [...selectedUsers, userId]
        : [userId];
    
    onChange({
      users: newUsers,
      groups: allowMultiple ? selectedGroups : []
    });
    if (!allowMultiple) setOpen(false);
  };

  const handleGroupToggle = (groupId: string) => {
    const newGroups = selectedGroups.includes(groupId)
      ? selectedGroups.filter((id: string) => id !== groupId)
      : allowMultiple 
        ? [...selectedGroups, groupId]
        : [groupId];
    
    onChange({
      users: allowMultiple ? selectedUsers : [],
      groups: newGroups
    });
    if (!allowMultiple) setOpen(false);
  };

  const handleRemoveUser = (userId: string) => {
    onChange({
      users: selectedUsers.filter((id: string) => id !== userId),
      groups: selectedGroups
    });
  };

  const handleRemoveGroup = (groupId: string) => {
    onChange({
      users: selectedUsers,
      groups: selectedGroups.filter((id: string) => id !== groupId)
    });
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        Default {allowMultiple ? 'Users/Groups' : 'User/Group'}:
      </Label>

      {/* Display selected users and groups */}
      {(selectedUsers.length > 0 || selectedGroups.length > 0) && (
        <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/20">
          {selectedUsers.map((userId: string) => {
            const user = filteredUsers.find(u => u.id === userId);
            if (!user) return null;
            return (
              <Badge key={userId} variant="secondary" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {user.email}
                <button
                  type="button"
                  onClick={() => handleRemoveUser(userId)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          {selectedGroups.map((groupId: string) => {
            const group = filteredGroups.find(g => g.id === groupId);
            if (!group) return null;
            return (
              <Badge key={groupId} variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {group.name}
                <button
                  type="button"
                  onClick={() => handleRemoveGroup(groupId)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between"
            disabled={usersLoading || groupsLoading}
          >
            {usersLoading || groupsLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <span className="truncate">
                  {selectedUsers.length + selectedGroups.length > 0
                    ? `${selectedUsers.length + selectedGroups.length} selected`
                    : 'Select users or groups'}
                </span>
                <ChevronDown className="h-4 w-4 ml-2 shrink-0 opacity-50" />
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search users or groups..." />
            <CommandEmpty>No users or groups found.</CommandEmpty>
            <ScrollArea className="h-72">
              <CommandList>
                {filteredUsers.length > 0 && (
                  <CommandGroup heading="Users">
                    {filteredUsers.map((user) => (
                      <CommandItem
                        key={user.id}
                        onSelect={() => handleUserToggle(user.id)}
                        className="flex items-center gap-2"
                      >
                        <div
                          className={cn(
                            'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                            selectedUsers.includes(user.id)
                              ? 'bg-primary text-primary-foreground'
                              : 'opacity-50 [&_svg]:invisible'
                          )}
                        >
                          <Check className={cn('h-4 w-4')} />
                        </div>
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="text-sm">{user.email}</span>
                          {user.first_name && (
                            <span className="text-xs text-muted-foreground">
                              {user.first_name} {user.last_name}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {filteredGroups.length > 0 && (
                  <CommandGroup heading="Groups">
                    {filteredGroups.map((group) => (
                      <CommandItem
                        key={group.id}
                        onSelect={() => handleGroupToggle(group.id)}
                        className="flex items-center gap-2"
                      >
                        <div
                          className={cn(
                            'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                            selectedGroups.includes(group.id)
                              ? 'bg-primary text-primary-foreground'
                              : 'opacity-50 [&_svg]:invisible'
                          )}
                        >
                          <Check className={cn('h-4 w-4')} />
                        </div>
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{group.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </ScrollArea>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
