import React from 'react';
import { Button } from '@/components/ui/button';
import { FormStatusSelector } from '@/components/FormStatusSelector';
import { FormSharing } from '@/components/FormSharing';
import { FormUserAccess } from '@/components/FormUserAccess';
import { FormPermissionHelp } from '@/components/FormPermissionHelp';
import { Save, Eye, Users, Settings, Shield } from 'lucide-react';
import { Form } from '@/types/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  onUpdateForm
}: FormBuilderHeaderProps) {
  return <div className="flex gap-2 items-center justify-between">
      <div className="flex gap-2 items-center">
        <Button variant="outline" onClick={() => onSave(false)} disabled={isSaving || isPublishing}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : isCreating ? 'Save Form' : 'Save Changes'}
        </Button>
        <Button onClick={() => onSave(true)} disabled={isSaving || isPublishing}>
          <Eye className="h-4 w-4 mr-2" />
          {isPublishing ? 'Publishing...' : isCreating ? 'Create & Publish' : 'Publish'}
        </Button>
        {currentForm && <>
            <FormSharing form={currentForm} onUpdateForm={onUpdateForm} />
            
            {/* Form Lifecycle Management */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Lifecycle
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Form Lifecycle Management</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Current Status</label>
                    <FormStatusSelector value={formStatus} onValueChange={onStatusChange} label="" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>Form lifecycle allows you to manage the form's availability and permissions:</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li><strong>Draft:</strong> Form is being built and not accessible to users</li>
                      <li><strong>Active:</strong> Form is live and accepting submissions</li>
                      <li><strong>Inactive:</strong> Form is disabled but data is preserved</li>
                      <li><strong>Archived:</strong> Form is stored for reference only</li>
                    </ul>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* User Access Management */}
            <Dialog>
              <DialogTrigger asChild>
                
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>User Access Management</DialogTitle>
                </DialogHeader>
                <FormUserAccess form={currentForm} onUpdateForm={onUpdateForm} />
              </DialogContent>
            </Dialog>

            {/* Permissions Help */}
            <Dialog>
              <DialogTrigger asChild>
                
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Form Permissions Guide</DialogTitle>
                </DialogHeader>
                <FormPermissionHelp />
              </DialogContent>
            </Dialog>
          </>}
      </div>

      {currentForm && <div className="flex items-center gap-4">
          <FormStatusSelector value={formStatus} onValueChange={onStatusChange} label="" />
          <div className="text-right">
            <span className="text-sm text-muted-foreground">
              Last updated: {new Date(currentForm.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>}
    </div>;
}