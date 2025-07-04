
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface FormStatusSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}

const FORM_STATUSES = [
  { value: 'draft', label: 'Draft', description: 'Form is being created or edited', color: 'bg-gray-100 text-gray-800' },
  { value: 'active', label: 'Active', description: 'Form is live and accepting submissions', color: 'bg-green-100 text-green-800' },
  { value: 'completed', label: 'Completed', description: 'Form has reached its completion criteria', color: 'bg-blue-100 text-blue-800' },
  { value: 'approved', label: 'Approved', description: 'Form has been approved by reviewers', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'rejected', label: 'Rejected', description: 'Form has been rejected and needs revision', color: 'bg-red-100 text-red-800' },
  { value: 'pending_review', label: 'Pending Review', description: 'Form is waiting for review', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'in_progress', label: 'In Progress', description: 'Form is being actively worked on', color: 'bg-purple-100 text-purple-800' },
  { value: 'archived', label: 'Archived', description: 'Form is no longer active but preserved', color: 'bg-gray-100 text-gray-600' }
];

export function FormStatusSelector({ value, onValueChange, label = "Form Status", disabled = false }: FormStatusSelectorProps) {
  const currentStatus = FORM_STATUSES.find(status => status.value === value);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {currentStatus && (
              <div className="flex items-center gap-2">
                <Badge className={`${currentStatus.color} text-xs`}>
                  {currentStatus.label}
                </Badge>
                <span className="text-sm">{currentStatus.description}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {FORM_STATUSES.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              <div className="flex items-center gap-2">
                <Badge className={`${status.color} text-xs`}>
                  {status.label}
                </Badge>
                <div className="flex flex-col">
                  <span className="font-medium">{status.label}</span>
                  <span className="text-xs text-muted-foreground">{status.description}</span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
