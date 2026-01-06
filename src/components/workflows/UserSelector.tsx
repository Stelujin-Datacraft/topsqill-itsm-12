
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UserSelectorProps {
  value: any;
  onValueChange: (value: any) => void;
}

export function UserSelector({ value, onValueChange }: UserSelectorProps) {
  const handleTypeChange = (type: string) => {
    if (type === 'form_submitter') {
      onValueChange({ type: 'form_submitter' });
    } else if (type === 'specific_user') {
      onValueChange({ type: 'specific_user', email: '' });
    }
  };

  const handleEmailChange = (email: string) => {
    onValueChange({ ...value, email });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Assignment Type</Label>
        <Select value={value?.type || 'form_submitter'} onValueChange={handleTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select assignment type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="form_submitter">Assign to Form Submitter</SelectItem>
            <SelectItem value="specific_user">Assign to Specific User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value?.type === 'specific_user' && (
        <div>
          <Label htmlFor="userEmail">User Email</Label>
          <Input
            id="userEmail"
            type="email"
            value={value?.email || ''}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="Enter user email address"
          />
        </div>
      )}

      <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
        <strong>Current setting:</strong> {
          value?.type === 'form_submitter' 
            ? 'Form will be assigned to the person who submitted the triggering form'
            : value?.type === 'specific_user'
            ? `Form will be assigned to: ${value?.email || 'Please enter email'}`
            : 'Please select assignment type'
        }
      </div>
    </div>
  );
}
