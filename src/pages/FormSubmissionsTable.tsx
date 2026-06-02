import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, BarChart3, Save, ArrowLeft, Search } from 'lucide-react';
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
    <DashboardLayout 
      title="Form Submissions Data Table" 
      actions={
        <div className="flex items-center gap-2">
          {selectedFormId && (
            <Button variant="outline" onClick={() => setShowSaveDialog(true)} disabled={!selectedFormId}>
              <Save className="h-4 w-4 mr-2" />
              Save as Report
            </Button>
          )}
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      }
    >
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
                      {accessibleForms.map(form => (
                        <SelectItem key={form.id} value={form.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{form.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedForm && (
                  <div className="text-right">
                    <h3 className="font-semibold text-lg">{selectedForm.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {loading ? 'Loading...' : `${submissions.length} total submissions`}
                    </p>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Data Table */}
          {selectedFormId ? (
            <Card className="flex-1 min-h-0 overflow-hidden group hover:shadow-2xl transition-all duration-500">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-cyan-50 group-hover:from-emerald-100 group-hover:to-cyan-100 transition-all duration-500 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                      Smart Data Table
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Powerful data visualization with filtering, sorting, and real-time updates
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 h-full">
                <div className="h-full">
                  <DynamicTable config={tableConfig} />
                </div>
                <div className="p-3 border-t bg-muted/30 group-hover:bg-gradient-to-r group-hover:from-emerald-50/50 group-hover:to-cyan-50/50 transition-all duration-500">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Search className="h-3.5 w-3.5" />
                      <span>Real-time search & filter</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 transition-all duration-300">
                        📊 SQL Queries
                      </Badge>
                      <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 group-hover:bg-cyan-200 transition-all duration-300">
                        📈 Live Updates
                      </Badge>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 group-hover:bg-purple-200 transition-all duration-300">
                        🔄 Auto-refresh
                      </Badge>
                    </div>
                  </div>
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
        <ReportSaveDialog 
          isOpen={showSaveDialog} 
          onOpenChange={setShowSaveDialog} 
          tableConfig={tableConfig} 
          formName={selectedForm?.name || ''} 
        />
      </DashboardLayout>
  );
}