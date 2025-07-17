
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, BarChart3, Save } from 'lucide-react';
import { useForm } from '@/contexts/FormContext';
import { useFormSubmissionData } from '@/hooks/useFormSubmissionData';
import { useFormSubmissionAccess } from '@/hooks/useFormSubmissionAccess';
import { useAccessibleForms } from '@/hooks/useAccessibleForms';
import { DynamicTable } from '@/components/reports/DynamicTable';
import { ReportSaveDialog } from '@/components/ReportSaveDialog';

interface FormSubmissionsDialogProps {
  children: React.ReactNode;
  initialFormId?: string;
}

export function FormSubmissionsDialog({ children, initialFormId }: FormSubmissionsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState(initialFormId || '');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const { forms } = useForm();
  const { accessibleForms } = useAccessibleForms();
  const { submissions, loading } = useFormSubmissionData(selectedFormId);
  const { canViewSubmissions, canExportData } = useFormSubmissionAccess(selectedFormId);

  const selectedForm = forms.find(f => f.id === selectedFormId);

  const tableConfig = {
    title: selectedForm ? `${selectedForm.name} Submissions` : 'Form Submissions',
    formId: selectedFormId,
    selectedColumns: selectedForm?.fields.map(f => f.id) || [],
    showMetadata: true,
    enableFiltering: true,
    enableSorting: true,
    enableSearch: true
  };

  if (!canViewSubmissions && selectedFormId) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              You don't have permission to view submissions for this form.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Form Submissions Data Table
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 overflow-auto">
            {/* Form Selection */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Form</label>
                <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                  <SelectTrigger className="w-80">
                    <SelectValue placeholder="Choose a form to view submissions" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessibleForms.map(form => (
                      <SelectItem key={form.id} value={form.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{form.name}</span>
                          <Badge variant="secondary" className="ml-2">
                            {submissions.length} submissions
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedFormId && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowSaveDialog(true)}
                    disabled={!selectedFormId}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save as Report
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      // Navigate to chart builder with form data
                      window.open(`/report-editor/new?formId=${selectedFormId}`, '_blank');
                    }}
                    disabled={!selectedFormId}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Create Chart
                  </Button>
                </div>
              )}
            </div>

            {/* Data Table */}
            {selectedFormId && (
              <div className="border rounded-lg bg-white">
                <DynamicTable 
                  config={tableConfig}
                />
              </div>
            )}

            {!selectedFormId && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a form to view its submission data</p>
                <p className="text-sm">Choose from the dropdown above to get started</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Report Dialog */}
      <ReportSaveDialog
        isOpen={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        tableConfig={tableConfig}
        formName={selectedForm?.name || ''}
      />
    </>
  );
}
