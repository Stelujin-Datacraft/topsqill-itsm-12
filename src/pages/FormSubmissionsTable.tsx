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
  return <div className="min-h-screen bg-background">
      <DashboardLayout title="Form Submissions Data Table" actions={<div className="flex items-center gap-2">
          {selectedFormId && <>
              <Button variant="outline" onClick={() => setShowSaveDialog(true)} disabled={!selectedFormId}>
                <Save className="h-4 w-4 mr-2" />
                Save as Report
              </Button>
            </>}
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>}>
      <div className="space-y-6 h-full">
        {/* Form Selection Header */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <CardTitle className="text-2xl">Select Form</CardTitle>
                <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                  <SelectTrigger className="w-80">
                    <SelectValue placeholder="Choose a form to view submissions" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessibleForms.map(form => <SelectItem key={form.id} value={form.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{form.name}</span>
                        </div>
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {selectedForm && <div className="text-right">
                  <h3 className="font-semibold text-lg">{selectedForm.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {submissions.length} total submissions
                  </p>
                </div>}
            </div>
          </CardHeader>
        </Card>

        {/* Data Table */}
        {selectedFormId ? (
          <Card className="flex-1 min-h-0 overflow-hidden">
            <CardContent className="p-0 h-full">
              <div className="h-full">
                <DynamicTable config={tableConfig} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex-1">
            <CardContent className="flex items-center justify-center h-full py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Form Selected</h3>
                <p>Select a form to view its submission data</p>
                <p className="text-sm">Choose from the dropdown above to get started</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Save Report Dialog */}
      <ReportSaveDialog isOpen={showSaveDialog} onOpenChange={setShowSaveDialog} tableConfig={tableConfig} formName={selectedForm?.name || ''} />
    </DashboardLayout>
    </div>;
}