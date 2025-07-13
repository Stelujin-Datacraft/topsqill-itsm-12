import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRoles } from '@/hooks/useRoles';

interface UserPickerFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors?: Record<string, string>;
}

export function UserPickerFieldConfig({ config, onUpdate, errors }: UserPickerFieldConfigProps) {
  const customConfig = config.customConfig || {};
  const { roles, loading: rolesLoading } = useRoles();

  const handleConfigChange = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value
      }
    });
  };

  return (
    <div className="space-y-6">
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