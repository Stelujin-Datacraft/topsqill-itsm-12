import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFormsData } from '@/hooks/useFormsData';

interface ApprovalFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors?: Record<string, string>;
}

export function ApprovalFieldConfig({ config, onUpdate, errors }: ApprovalFieldConfigProps) {
  const customConfig = config.customConfig || {};
  const { forms } = useFormsData();

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
        
        <div className="space-y-2">
          <Label htmlFor="targetForm">Target Form to Approve</Label>
          <Select
            value={customConfig.targetFormId || ''}
            onValueChange={(value) => handleConfigChange('targetFormId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select form to approve" />
            </SelectTrigger>
            <SelectContent>
              {forms.map((form) => (
                <SelectItem key={form.id} value={form.id}>
                  {form.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            The form that will be approved when this field is activated
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="approvalCondition">Approval Condition</Label>
          <Select
            value={customConfig.approvalCondition || 'manual'}
            onValueChange={(value) => handleConfigChange('approvalCondition', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select approval condition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual approval required</SelectItem>
              <SelectItem value="automatic">Auto-approve on condition</SelectItem>
              <SelectItem value="threshold">Approve after X approvals</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {customConfig.approvalCondition === 'threshold' && (
          <div className="space-y-2">
            <Label htmlFor="requiredApprovals">Required Approvals</Label>
            <Input
              id="requiredApprovals"
              type="number"
              min="1"
              value={customConfig.requiredApprovals || 1}
              onChange={(e) => handleConfigChange('requiredApprovals', parseInt(e.target.value) || 1)}
              placeholder="1"
            />
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