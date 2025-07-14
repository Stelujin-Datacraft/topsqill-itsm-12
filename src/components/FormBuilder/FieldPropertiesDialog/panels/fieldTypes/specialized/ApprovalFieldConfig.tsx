
import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useForm } from '@/contexts/FormContext';

interface ApprovalFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors?: Record<string, string>;
}

export function ApprovalFieldConfig({ config, onUpdate, errors }: ApprovalFieldConfigProps) {
  const customConfig = config.customConfig || {};
  const { currentForm } = useForm();

  // Find all cross-reference fields in the current form
  const crossReferenceFields = currentForm?.fields?.filter(field => field.type === 'cross-reference') || [];

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
        <h3 className="text-lg font-medium">Approval Configuration</h3>
        
        <div className="space-y-3">
          <Label>Approval Target</Label>
          <div className="flex items-center space-x-2">
            <Switch
              checked={customConfig.approveCurrentSubmission !== false}
              onCheckedChange={(checked) => handleConfigChange('approveCurrentSubmission', checked)}
            />
            <Label>
              {customConfig.approveCurrentSubmission !== false ? 'Approve Current Submission' : 'Approve Cross-Reference Selections'}
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            {customConfig.approveCurrentSubmission !== false 
              ? 'This will approve the current form submission when activated'
              : 'This will approve submissions selected in a cross-reference field'
            }
          </p>
        </div>

        {customConfig.approveCurrentSubmission === false && (
          <div className="space-y-2">
            <Label htmlFor="crossReferenceField">Cross-Reference Field</Label>
            {crossReferenceFields.length > 0 ? (
              <Select
                value={customConfig.crossReferenceFieldId || ''}
                onValueChange={(value) => handleConfigChange('crossReferenceFieldId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cross-reference field" />
                </SelectTrigger>
                <SelectContent>
                  {crossReferenceFields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-4 border border-dashed border-muted-foreground/30 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  No cross-reference fields found. Please add a cross-reference field to this form first.
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Select which cross-reference field's selections should be approved
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="approvalMessage">Approval Message Template</Label>
          <Textarea
            id="approvalMessage"
            value={customConfig.approvalMessage || ''}
            onChange={(e) => handleConfigChange('approvalMessage', e.target.value)}
            placeholder="Form approved by {approver} on {date}"
            rows={3}
          />
          <p className="text-sm text-muted-foreground">
            Available variables: {'{approver}'}, {'{date}'}, {'{time}'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="requireComments"
            checked={customConfig.requireComments || false}
            onCheckedChange={(checked) => handleConfigChange('requireComments', checked)}
          />
          <Label htmlFor="requireComments">Require approval comments</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="sendNotifications"
            checked={customConfig.sendNotifications !== false}
            onCheckedChange={(checked) => handleConfigChange('sendNotifications', checked)}
          />
          <Label htmlFor="sendNotifications">Send notification on approval</Label>
        </div>
      </div>
    </div>
  );
}
