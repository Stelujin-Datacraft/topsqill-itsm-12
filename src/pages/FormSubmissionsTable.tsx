import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, BarChart3, Save, ArrowLeft } from 'lucide-react';
import { useForm } from '@/contexts/FormContext';
import { useFormSubmissionData } from '@/hooks/useFormSubmissionData';
import { useFormSubmissionAccess } from '@/hooks/useFormSubmissionAccess';
import { useAccessibleForms } from '@/hooks/useAccessibleForms';
import { DynamicTable } from '@/components/reports/DynamicTable';
import { ReportSaveDialog } from '@/components/ReportSaveDialog';
import DashboardLayout from '@/components/DashboardLayout';
export default function FormSubmissionsTable() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFormId = searchParams.get('formId') || '';
  const submissionRef = searchParams.get('submissionRef');
  const [selectedFormId, setSelectedFormId] = useState(initialFormId);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const {
    forms
  } = useForm();
  const {
    accessibleForms
  } = useAccessibleForms();
  const {
    submissions,
    loading
  } = useFormSubmissionData(selectedFormId);
  const {
    canViewSubmissions,
    canExportData
  } = useFormSubmissionAccess(selectedFormId);
  const selectedForm = forms.find(f => f.id === selectedFormId);

  // Update URL when form selection changes
  useEffect(() => {
    if (selectedFormId) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('formId', selectedFormId);
      navigate(`/form-submissions?${newParams.toString()}`, {
        replace: true
      });
    }
  }, [selectedFormId, navigate, searchParams]);
  const tableConfig = {
    title: selectedForm ? `${selectedForm.name} Submissions` : 'Form Submissions',
    formId: selectedFormId,
    selectedColumns: selectedForm?.fields.map(f => f.id) || [],
    showMetadata: true,
    enableFiltering: true,
    enableSorting: true,
    enableSearch: true,
    highlightSubmissionRef: submissionRef
  };
  const handleBack = () => {
    navigate(-1);
  };
  if (!canViewSubmissions && selectedFormId) {
    return <DashboardLayout title="Form Submissions" actions={<Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>}>
        <div className="flex items-center justify-center h-full">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-center">Access Denied</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  You don't have permission to view submissions for this form.
                </p>
                <Button onClick={handleBack} className="mt-4">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>;
  }
  return (
    <div className="min-h-screen bg-background">
      <DashboardLayout 
        title="Form Submissions" 
        actions={
          <div className="flex items-center gap-3">
            {selectedFormId && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSaveDialog(true)} 
                disabled={!selectedFormId}
                className="h-9"
              >
                <Save className="h-4 w-4 mr-2" />
                Save as Report
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleBack}
              className="h-9"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-6 h-full">
          {/* Form Selection Header */}
          <Card className="shrink-0">
            <CardHeader className="py-4 px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-3">
                  <CardTitle className="text-xl font-semibold">Select Form</CardTitle>
                  <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                    <SelectTrigger className="w-full sm:w-80">
                      <SelectValue placeholder="Choose a form to view submissions" />
                    </SelectTrigger>
                    <SelectContent>
                      {accessibleForms.map(form => (
                        <SelectItem key={form.id} value={form.id}>
                          <span>{form.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedForm && (
                  <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0">
                    <h3 className="font-semibold text-base text-foreground">{selectedForm.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {submissions.length} {submissions.length === 1 ? 'submission' : 'submissions'}
                    </p>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Data Table */}
          {selectedFormId ? (
            <Card className="flex-1 min-h-0 overflow-hidden">
              <CardContent className="p-0 h-full">
                <DynamicTable config={tableConfig} />
              </CardContent>
            </Card>
          ) : (
            <Card className="flex-1">
              <CardContent className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center space-y-3">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground/70" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground">No Form Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-[250px]">
                      Select a form from the dropdown above to view its submission data
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Save Report Dialog */}
        <ReportSaveDialog 
          isOpen={showSaveDialog} 
          onOpenChange={setShowSaveDialog} 
          tableConfig={tableConfig} 
          formName={selectedForm?.name || ''} 
        />
      </DashboardLayout>
    </div>
  );
}