
import React from 'react';
import { Button } from '@/components/ui/button';
import { FormStatusSelector } from '@/components/FormStatusSelector';
import { FormSharing } from '@/components/FormSharing';
import { Save, Eye } from 'lucide-react';
import { Form } from '@/types/form';

interface FormBuilderHeaderProps {
  onSave: (shouldPublish?: boolean) => void;
  isSaving: boolean;
  isPublishing: boolean;
  isCreating: boolean;
  currentForm: Form | null;
  formStatus: Form['status'];
  onStatusChange: (status: Form['status']) => void;
  onUpdateForm: (updates: any) => void;
}

export function FormBuilderHeader({
  onSave,
  isSaving,
  isPublishing,
  isCreating,
  currentForm,
  formStatus,
  onStatusChange,
  onUpdateForm,
}: FormBuilderHeaderProps) {
  return (
    <div className="flex gap-2 items-center justify-between">
      <div className="flex gap-2 items-center">
        <Button variant="outline" onClick={() => onSave(false)} disabled={isSaving || isPublishing}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : isCreating ? 'Save Form' : 'Save Changes'}
        </Button>
        <Button onClick={() => onSave(true)} disabled={isSaving || isPublishing}>
          <Eye className="h-4 w-4 mr-2" />
          {isPublishing ? 'Publishing...' : isCreating ? 'Create & Publish' : 'Publish'}
        </Button>
        {currentForm && (
          <FormSharing form={currentForm} onUpdateForm={onUpdateForm} />
        )}
      </div>

      {currentForm && (
        <div className="flex items-center gap-4">
          <FormStatusSelector
            value={formStatus}
            onValueChange={onStatusChange}
            label=""
          />
          <div className="text-right">
            <span className="text-sm text-muted-foreground">
              Last updated: {new Date(currentForm.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
