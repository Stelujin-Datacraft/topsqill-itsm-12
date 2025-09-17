
import React, { useState } from 'react';
import { FieldConfiguration } from '../../../hooks/useFieldConfiguration';
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
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useGroups } from '@/hooks/useGroups';
import { cn } from '@/lib/utils';

interface SubmissionAccessFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
}

export function SubmissionAccessFieldConfig({ config, onUpdate, errors }: SubmissionAccessFieldConfigProps) {
  const { users, loading: usersLoading } = useOrganizationUsers();
  const { groups, loading: groupsLoading } = useGroups();
  
  const [userSelectorOpen, setUserSelectorOpen] = useState(false);
  const [groupSelectorOpen, setGroupSelectorOpen] = useState(false);
  
  // Handle admin pre-selection of users and groups
  const selectedUserIds = config.customConfig?.allowedUsers || [];
  const selectedGroupIds = config.customConfig?.allowedGroups || [];
  
  const handleUserToggle = (userId: string) => {
    const newUserIds = selectedUserIds.includes(userId)
      ? selectedUserIds.filter((id: string) => id !== userId)
      : [...selectedUserIds, userId];
    onUpdate({ 
      customConfig: { 
        ...config.customConfig, 
        allowedUsers: newUserIds 
      } 
    });
  };
  
  const handleGroupToggle = (groupId: string) => {
    const newGroupIds = selectedGroupIds.includes(groupId)
      ? selectedGroupIds.filter((id: string) => id !== groupId)
      : [...selectedGroupIds, groupId];
    onUpdate({ 
      customConfig: { 
        ...config.customConfig, 
        allowedGroups: newGroupIds 
      } 
    });
  };
  
  const removeUser = (userId: string) => {
    onUpdate({ 
      customConfig: { 
        ...config.customConfig, 
        allowedUsers: selectedUserIds.filter((id: string) => id !== userId) 
      } 
    });
  };
  
  const removeGroup = (groupId: string) => {
    onUpdate({ 
      customConfig: { 
        ...config.customConfig, 
        allowedGroups: selectedGroupIds.filter((id: string) => id !== groupId) 
      } 
    });
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
        <h3 className="text-lg font-medium">Access Configuration</h3>
        
        <div>
        <Label htmlFor="accessLevel">Access Level</Label>
        <Select
          value={config.customConfig?.accessLevel || 'view'}
          onValueChange={(value) => onUpdate({ 
            customConfig: { 
              ...config.customConfig, 
              accessLevel: value 
            } 
          })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="view">View Only</SelectItem>
            <SelectItem value="edit">View & Edit</SelectItem>
            <SelectItem value="admin">Full Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="accessDuration">Access Duration (days)</Label>
        <Input
          id="accessDuration"
          type="number"
          value={config.customConfig?.accessDuration || ''}
          onChange={(e) => onUpdate({ 
            customConfig: { 
              ...config.customConfig, 
              accessDuration: parseInt(e.target.value) || undefined 
            } 
          })}
          placeholder="Leave empty for permanent access"
          min="1"
        />
        <p className="text-xs text-gray-500 mt-1">
          How long should the user have access to this submission?
        </p>
      </div>

      <div>
        <Label htmlFor="notificationMessage">Notification Message</Label>
        <Textarea
          id="notificationMessage"
          value={config.customConfig?.notificationMessage || ''}
          onChange={(e) => onUpdate({ 
            customConfig: { 
              ...config.customConfig, 
              notificationMessage: e.target.value 
            } 
          })}
          placeholder="Message to send when user is granted access"
          rows={3}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="requireConfirmation"
            checked={config.customConfig?.requireConfirmation || false}
            onCheckedChange={(checked) => onUpdate({ 
              customConfig: { 
                ...config.customConfig, 
                requireConfirmation: Boolean(checked) 
              } 
            })}
          />
          <Label htmlFor="requireConfirmation">Require user confirmation</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="sendNotification"
            checked={config.customConfig?.sendNotification !== false}
            onCheckedChange={(checked) => onUpdate({ 
              customConfig: { 
                ...config.customConfig, 
                sendNotification: Boolean(checked) 
              } 
            })}
          />
          <Label htmlFor="sendNotification">Send notification email</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowMultiple"
            checked={config.customConfig?.allowMultiple || false}
            onCheckedChange={(checked) => onUpdate({ 
              customConfig: { 
                ...config.customConfig, 
                allowMultiple: Boolean(checked) 
              } 
            })}
          />
          <Label htmlFor="allowMultiple">Allow multiple user/group selection</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="logAccess"
            checked={config.customConfig?.logAccess !== false}
            onCheckedChange={(checked) => onUpdate({ 
              customConfig: { 
                ...config.customConfig, 
                logAccess: Boolean(checked) 
              } 
            })}
          />
          <Label htmlFor="logAccess">Log access activities</Label>
        </div>
      </div>
      </div>
    </div>
  );
}
