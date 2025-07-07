
import React from 'react';
import { FieldConfiguration } from '../../../hooks/useFieldConfiguration';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface SubmissionAccessFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
}

export function SubmissionAccessFieldConfig({ config, onUpdate, errors }: SubmissionAccessFieldConfigProps) {
  return (
    <div className="space-y-4">
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
          <Label htmlFor="allowMultiple">Allow multiple user selection</Label>
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
  );
}
