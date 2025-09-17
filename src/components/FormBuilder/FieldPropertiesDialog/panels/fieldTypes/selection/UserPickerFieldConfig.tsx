import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronDown, X, Users, UserCheck } from 'lucide-react';
import { useRoles } from '@/hooks/useRoles';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useGroups } from '@/hooks/useGroups';
import { cn } from '@/lib/utils';

interface UserPickerFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors?: Record<string, string>;
}

export function UserPickerFieldConfig({ config, onUpdate, errors }: UserPickerFieldConfigProps) {
  const customConfig = config.customConfig || {};
  const { roles, loading: rolesLoading } = useRoles();
  const { users, loading: usersLoading } = useOrganizationUsers();
  const { groups, loading: groupsLoading } = useGroups();
  
  const [userSelectorOpen, setUserSelectorOpen] = useState(false);
  const [groupSelectorOpen, setGroupSelectorOpen] = useState(false);

  const handleConfigChange = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value
      }
    });
  };

  // Handle admin pre-selection of users
  const selectedUserIds = customConfig.allowedUsers || [];
  const selectedGroupIds = customConfig.allowedGroups || [];
  
  const handleUserToggle = (userId: string) => {
    const newUserIds = selectedUserIds.includes(userId)
      ? selectedUserIds.filter((id: string) => id !== userId)
      : [...selectedUserIds, userId];
    handleConfigChange('allowedUsers', newUserIds);
  };
  
  const handleGroupToggle = (groupId: string) => {
    const newGroupIds = selectedGroupIds.includes(groupId)
      ? selectedGroupIds.filter((id: string) => id !== groupId)
      : [...selectedGroupIds, groupId];
    handleConfigChange('allowedGroups', newGroupIds);
  };
  
  const removeUser = (userId: string) => {
    handleConfigChange('allowedUsers', selectedUserIds.filter((id: string) => id !== userId));
  };
  
  const removeGroup = (groupId: string) => {
    handleConfigChange('allowedGroups', selectedGroupIds.filter((id: string) => id !== groupId));
  };
  
  const selectedUsers = users?.filter(user => selectedUserIds.includes(user.id)) || [];
  const selectedGroups = groups?.filter(group => selectedGroupIds.includes(group.id)) || [];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Available Users & Groups (Admin Configuration)</h3>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Pre-select Available Users</Label>
            <p className="text-sm text-muted-foreground">
              Choose which users will be available for selection in this field. If none selected, all organization users will be available.
            </p>
            
            {/* Selected Users Display */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedUsers.map((user) => (
                  <Badge key={user.id} variant="secondary" className="flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    <span>{user.first_name} {user.last_name} ({user.email})</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => removeUser(user.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
            
            {/* User Selector */}
            <Popover open={userSelectorOpen} onOpenChange={setUserSelectorOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Select Users
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search users..." />
                  <CommandList>
                    <CommandEmpty>
                      {usersLoading ? "Loading users..." : "No users found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {users?.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={user.id}
                          onSelect={() => handleUserToggle(user.id)}
                          className="flex items-center gap-3"
                        >
                          <Check
                            className={cn(
                              "h-4 w-4",
                              selectedUserIds.includes(user.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <Users className="h-4 w-4" />
                          <div className="flex-1">
                            <div className="font-medium">{user.first_name} {user.last_name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {user.role}
                          </Badge>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Pre-select Available Groups</Label>
            <p className="text-sm text-muted-foreground">
              Choose which groups will be available for selection in this field.
            </p>
            
            {/* Selected Groups Display */}
            {selectedGroups.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedGroups.map((group) => (
                  <Badge key={group.id} variant="secondary" className="flex items-center gap-2">
                    <UserCheck className="h-3 w-3" />
                    <span>{group.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => removeGroup(group.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
            
            {/* Group Selector */}
            <Popover open={groupSelectorOpen} onOpenChange={setGroupSelectorOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Select Groups
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search groups..." />
                  <CommandList>
                    <CommandEmpty>
                      {groupsLoading ? "Loading groups..." : "No groups found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {groups?.map((group) => (
                        <CommandItem
                          key={group.id}
                          value={group.id}
                          onSelect={() => handleGroupToggle(group.id)}
                          className="flex items-center gap-3"
                        >
                          <Check
                            className={cn(
                              "h-4 w-4",
                              selectedGroupIds.includes(group.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <UserCheck className="h-4 w-4" />
                          <div className="flex-1">
                            <div className="font-medium">{group.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {group.member_count || 0} members
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">User Selection Configuration</h3>
        
        <div className="space-y-2">
          <Label htmlFor="maxSelections">Maximum Selections</Label>
          <Input
            id="maxSelections"
            type="number"
            min="1"
            value={customConfig.maxSelections || 1}
            onChange={(e) => handleConfigChange('maxSelections', parseInt(e.target.value) || 1)}
            placeholder="1"
          />
          <p className="text-sm text-muted-foreground">
            Set to 1 for single selection, or higher for multiple user selection
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="searchDelay">Search Delay (ms)</Label>
          <Input
            id="searchDelay"
            type="number"
            min="0"
            value={customConfig.searchDelay || 300}
            onChange={(e) => handleConfigChange('searchDelay', parseInt(e.target.value) || 300)}
            placeholder="300"
          />
          <p className="text-sm text-muted-foreground">
            Delay in milliseconds before performing user search
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowMultiple"
            checked={customConfig.allowMultiple || false}
            onCheckedChange={(checked) => handleConfigChange('allowMultiple', checked)}
          />
          <Label htmlFor="allowMultiple">Allow Multiple Selection</Label>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Role Assignment Configuration</h3>
        
        <div className="space-y-2">
          <Label htmlFor="assignRole">Role to Assign</Label>
          <Select
            value={customConfig.assignRole || 'none'}
            onValueChange={(value) => handleConfigChange('assignRole', value === 'none' ? '' : value)}
            disabled={rolesLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={rolesLoading ? "Loading roles..." : "Select role to assign..."} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No role assignment</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            This role will be assigned to the selected user when the form is submitted
          </p>
        </div>


        <div className="flex items-center space-x-2">
          <Checkbox
            id="enableNotifications"
            checked={customConfig.enableNotifications !== false}
            onCheckedChange={(checked) => handleConfigChange('enableNotifications', checked)}
          />
          <Label htmlFor="enableNotifications">Send Notification to Assigned User</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notificationMessage">Custom Notification Message</Label>
          <Textarea
            id="notificationMessage"
            value={customConfig.notificationMessage || ''}
            onChange={(e) => handleConfigChange('notificationMessage', e.target.value)}
            placeholder="You have been assigned a new role in the project..."
            rows={3}
          />
          <p className="text-sm text-muted-foreground">
            Custom message to include in the notification (optional)
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Advanced Configuration</h3>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="requireConfirmation"
            checked={customConfig.requireConfirmation || false}
            onCheckedChange={(checked) => handleConfigChange('requireConfirmation', checked)}
          />
          <Label htmlFor="requireConfirmation">Require User Confirmation</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowSelfSelection"
            checked={customConfig.allowSelfSelection !== false}
            onCheckedChange={(checked) => handleConfigChange('allowSelfSelection', checked)}
          />
          <Label htmlFor="allowSelfSelection">Allow User to Select Themselves</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="roleFilter">Filter Users by Existing Role</Label>
          <Select
            value={customConfig.roleFilter || 'none'}
            onValueChange={(value) => handleConfigChange('roleFilter', value === 'none' ? '' : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="No filter (show all project users)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No filter</SelectItem>
              <SelectItem value="viewer">Only Viewers</SelectItem>
              <SelectItem value="editor">Only Editors</SelectItem>
              <SelectItem value="admin">Only Admins</SelectItem>
              <SelectItem value="member">Only Members</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Only show users with specific existing roles in the project
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showUserProfiles"
            checked={customConfig.showUserProfiles !== false}
            onCheckedChange={(checked) => handleConfigChange('showUserProfiles', checked)}
          />
          <Label htmlFor="showUserProfiles">Show User Profile Information</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="logAssignments"
            checked={customConfig.logAssignments !== false}
            onCheckedChange={(checked) => handleConfigChange('logAssignments', checked)}
          />
          <Label htmlFor="logAssignments">Log Role Assignments for Audit</Label>
        </div>
      </div>
    </div>
  );
}