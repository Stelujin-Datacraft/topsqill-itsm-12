
import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Check, ChevronDown, X, Users, Search, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useGroups } from '@/hooks/useGroups';

interface SubmissionAccessFieldProps {
  field: FormField;
  value: string | string[] | { users?: string[], groups?: string[] };
  onChange: (value: string | string[] | { users?: string[], groups?: string[] }) => void;
  error?: string;
  disabled?: boolean;
}

export function SubmissionAccessField({ field, value, onChange, error, disabled }: SubmissionAccessFieldProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const { users, loading: usersLoading } = useOrganizationUsers();
  const { groups, loading: groupsLoading, error: groupsError } = useGroups();

  const config = field.customConfig || {};
  const allowMultiple = config.allowMultiple !== false; // Default to true for multiple selection

  // Handle default values from rules - ensure they're within allowed users/groups
  useEffect(() => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const { users: userIds = [], groups: groupIds = [] } = value;
      const allowedUsers = (config as any)?.allowedUsers || [];
      const allowedGroups = (config as any)?.allowedGroups || [];
      
      // Filter default values to only include allowed ones
      let filteredUsers = userIds;
      let filteredGroups = groupIds;
      
      if (allowedUsers.length > 0) {
        filteredUsers = userIds.filter(userId => allowedUsers.includes(userId));
      }
      
      if (allowedGroups.length > 0) {
        filteredGroups = groupIds.filter(groupId => allowedGroups.includes(groupId));
      }
      
      // Update value if filtering occurred
      if (filteredUsers.length !== userIds.length || filteredGroups.length !== groupIds.length) {
        onChange({ users: filteredUsers, groups: filteredGroups });
      }
    }
  }, [value, config, onChange]);
  
  // Normalize value to handle both old format (array of user IDs) and new format (object with users/groups)
  const normalizedValue = React.useMemo(() => {
    if (!value) return { users: [], groups: [] };
    
    // Handle legacy format (array of user IDs or single user ID)
    if (Array.isArray(value)) {
      return { users: value, groups: [] };
    }
    
    if (typeof value === 'string') {
      return { users: [value], groups: [] };
    }
    
    // Handle new format
    if (typeof value === 'object' && value !== null) {
      return {
        users: value.users || [],
        groups: value.groups || []
      };
    }
    
    return { users: [], groups: [] };
  }, [value]);
  
  const selectedUserIds = normalizedValue.users;
  const selectedGroupIds = normalizedValue.groups;
  
  // Transform users to include name property and filter based on search
  const transformedUsers = React.useMemo(() => {
    if (!users || !Array.isArray(users)) return [];
    return users.map(user => ({
      id: user.id,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
      email: user.email,
      role: user.role
    }));
  }, [users]);

  // Transform groups for easier handling
  const transformedGroups = React.useMemo(() => {
    if (!groups || !Array.isArray(groups)) return [];
    return groups.map(group => ({
      id: group.id,
      name: group.name,
      member_count: group.member_count || 0,
      role_name: group.role_name
    }));
  }, [groups]);

  const filteredUsers = React.useMemo(() => {
    if (!transformedUsers.length) return [];
    
    let userList = transformedUsers;
    
    // Apply admin pre-selection filter - if allowedUsers exists but is empty, show no users
    if ((config as any)?.allowedUsers) {
      if ((config as any).allowedUsers.length > 0) {
        userList = userList.filter(user => (config as any).allowedUsers.includes(user.id));
      } else {
        // If allowedUsers exists but is empty, show no users
        userList = [];
      }
    }
    // If allowedUsers doesn't exist, show all users (backward compatibility)
    
    if (!searchValue?.trim()) return userList;
    
    const searchLower = searchValue.toLowerCase();
    return userList.filter(user =>
      user.name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.role.toLowerCase().includes(searchLower)
    );
  }, [transformedUsers, (config as any)?.allowedUsers, searchValue]);

  const filteredGroups = React.useMemo(() => {
    if (!transformedGroups.length) return [];
    
    let groupList = transformedGroups;
    
    // Apply admin pre-selection filter - if allowedGroups exists but is empty, show no groups
    if ((config as any)?.allowedGroups) {
      if ((config as any).allowedGroups.length > 0) {
        groupList = groupList.filter(group => (config as any).allowedGroups.includes(group.id));
      } else {
        // If allowedGroups exists but is empty, show no groups
        groupList = [];
      }
    }
    // If allowedGroups doesn't exist, show all groups (backward compatibility)
    
    if (!searchValue?.trim()) return groupList;
    
    const searchLower = searchValue.toLowerCase();
    return groupList.filter(group =>
      group.name.toLowerCase().includes(searchLower) ||
      (group.role_name && group.role_name.toLowerCase().includes(searchLower))
    );
  }, [transformedGroups, (config as any)?.allowedGroups, searchValue]);

  const selectedUsers = React.useMemo(() => {
    return transformedUsers.filter(user => selectedUserIds.includes(user.id));
  }, [transformedUsers, selectedUserIds]);

  const selectedGroups = React.useMemo(() => {
    return transformedGroups.filter(group => selectedGroupIds.includes(group.id));
  }, [transformedGroups, selectedGroupIds]);

  const handleUserSelect = (userId: string) => {
    if (allowMultiple) {
      let newUserIds = [...selectedUserIds];
      if (newUserIds.includes(userId)) {
        newUserIds = newUserIds.filter(id => id !== userId);
      } else {
        newUserIds.push(userId);
      }
      onChange({ users: newUserIds, groups: selectedGroupIds });
    } else {
      const isSelected = selectedUserIds.includes(userId);
      onChange({ 
        users: isSelected ? [] : [userId], 
        groups: isSelected ? selectedGroupIds : [] 
      });
      setOpen(false);
    }
    setSearchValue('');
  };

  const handleGroupSelect = (groupId: string) => {
    if (allowMultiple) {
      let newGroupIds = [...selectedGroupIds];
      if (newGroupIds.includes(groupId)) {
        newGroupIds = newGroupIds.filter(id => id !== groupId);
      } else {
        newGroupIds.push(groupId);
      }
      onChange({ users: selectedUserIds, groups: newGroupIds });
    } else {
      const isSelected = selectedGroupIds.includes(groupId);
      onChange({ 
        users: isSelected ? selectedUserIds : [], 
        groups: isSelected ? [] : [groupId] 
      });
      setOpen(false);
    }
    setSearchValue('');
  };

  const handleUserRemove = (userId: string) => {
    const newUserIds = selectedUserIds.filter(id => id !== userId);
    if (allowMultiple) {
      onChange({ users: newUserIds, groups: selectedGroupIds });
    } else {
      onChange({ users: [], groups: [] });
    }
  };

  const handleGroupRemove = (groupId: string) => {
    const newGroupIds = selectedGroupIds.filter(id => id !== groupId);
    if (allowMultiple) {
      onChange({ users: selectedUserIds, groups: newGroupIds });
    } else {
      onChange({ users: [], groups: [] });
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
    <>
      {/* Selected users and groups display */}
      {(selectedUsers.length > 0 || selectedGroups.length > 0) && (
        <div className="space-y-2 mb-2">
          {/* Selected Users */}
          {selectedUsers.map((user) => (
            <div key={`user-${user.id}`} className="flex items-center justify-between p-1 bg-blue-50 border border-blue-200 rounded">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <div>
                  <span className="font-medium ">{user.name}</span>
                  <span className="text-sm ml-2">({user.email})</span>
                  {/* <Badge variant="outline" className="ml-2 text-xs border-blue-300 text-blue-700">
                    {user.role}
                  </Badge> */}
                </div>
              </div>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUserRemove(user.id)}
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          
          {/* Selected Groups */}
          {selectedGroups.map((group) => (
            <div key={`group-${group.id}`} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                <div>
                  <span className="font-medium ">{group.name}</span>
                  <span className="text-sm ml-2">({group.member_count} members)</span>
                  {/* {group.role_name && (
                    <Badge variant="outline" className="ml-2 text-xs border-green-300 text-green-700">
                      {group.role_name}
                    </Badge>
                  )} */}
                </div>
              </div>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleGroupRemove(group.id)}
                  className="text-green-600 hover:text-green-800 hover:bg-green-100"
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
        <PopoverTrigger asChild className="mt-2">
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {(selectedUsers.length > 0 || selectedGroups.length > 0) ? (
              allowMultiple ? 
                `${selectedUsers.length + selectedGroups.length} item(s) selected` :
                selectedUsers.length > 0 ? selectedUsers[0].name : selectedGroups[0]?.name
            ) : (
              field.placeholder || "Select users or groups..."
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <div className="p-2">
            {/* Search input */}
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users and groups..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-8"
              />
            </div>
            
            {/* Users and Groups list */}
            <ScrollArea className="h-80">
              {(usersLoading || groupsLoading) ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  Loading...
                </div>
              ) : groupsError ? (
                <div className="p-4 text-center text-sm text-red-500">
                  Error loading groups: {groupsError}
                </div>
              ) : (filteredUsers.length === 0 && filteredGroups.length === 0) ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  No users or groups found.
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Users Section */}
                  {filteredUsers.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Users ({filteredUsers.length})
                      </div>
                      {filteredUsers.map((user) => (
                        <button
                          key={`user-${user.id}`}
                          onClick={() => handleUserSelect(user.id)}
                          className="w-full flex items-center gap-2 p-2 text-left hover:bg-blue-50 rounded-sm transition-colors"
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0 text-blue-600",
                              selectedUserIds.includes(user.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <Users className="h-4 w-4 text-blue-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{user.name}</div>
                            <div className="text-sm text-gray-500 truncate">{user.email}</div>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0 border-blue-300 text-blue-700">
                            {user.role}
                          </Badge>
                        </button>
                      ))}
                      
                      {filteredGroups.length > 0 && (
                        <Separator className="my-2" />
                      )}
                    </>
                  )}
                  
                  {/* Groups Section */}
                  {filteredGroups.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Groups ({filteredGroups.length})
                      </div>
                      {filteredGroups.map((group) => (
                        <button
                          key={`group-${group.id}`}
                          onClick={() => handleGroupSelect(group.id)}
                          className="w-full flex items-center gap-2 p-2 text-left hover:bg-green-50 rounded-sm transition-colors"
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0 text-green-600",
                              selectedGroupIds.includes(group.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <UserCheck className="h-4 w-4 text-green-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{group.name}</div>
                            <div className="text-sm text-gray-500 truncate">{group.member_count} members</div>
                          </div>
                          {group.role_name && (
                            <Badge variant="outline" className="text-xs shrink-0 border-green-300 text-green-700">
                              {group.role_name}
                            </Badge>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>

      {/* Configuration info
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
      </div> */}

      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </>
  );
}
