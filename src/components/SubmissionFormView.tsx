import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Edit, Save, X, Hash, Calendar, Clock } from 'lucide-react';
import { FormFieldsRenderer } from './FormFieldsRenderer';
import { FormPagination } from './FormPagination';
import { FormNavigationPanel } from './FormNavigationPanel';
import { SubmissionFormRenderer } from './SubmissionFormRenderer';
import { LifecycleStatusBar } from './LifecycleStatusBar';
import { Form, FormField } from '@/types/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface SubmissionFormViewProps {
  submissionId: string;
  onBack?: () => void;
}

interface FormSubmission {
  id: string;
  form_id: string;
  submitted_at: string;
  submission_data: Record<string, any>;
  submission_ref_id?: string;
  form_name?: string;
  form_reference_id?: string;
  approval_status?: string;
  approved_by?: string;
  approval_timestamp?: string;
}

export function SubmissionFormView({ submissionId, onBack }: SubmissionFormViewProps) {
  const [submission, setSubmission] = useState<FormSubmission | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [fieldStates, setFieldStates] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [canManageApproval, setCanManageApproval] = useState(false);
  const [currentPageId, setCurrentPageId] = useState<string>('');
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [navigationVisible, setNavigationVisible] = useState(true);

  // Find lifecycle dropdown fields (select fields with displayAsLifecycle enabled)
  // Must be called before any early returns to follow Rules of Hooks
  const lifecycleFields = useMemo(() => {
    if (!form?.fields) return [];
    return form.fields.filter(
      (field) => field.type === 'select' && (field.customConfig as any)?.displayAsLifecycle === true
    );
  }, [form?.fields]);

  // Load submission and form data
  const loadSubmissionAndForm = async () => {
    try {
      setLoading(true);
      
      console.log('Loading submission:', submissionId);
      
      // Load submission data with form details
      const { data: submissionData, error: submissionError } = await supabase
        .from('form_submissions')
        .select(`
          *,
          forms!inner(name, reference_id)
        `)
        .eq('id', submissionId)
        .single();

      if (submissionError) {
        console.error('Error loading submission:', submissionError);
        throw submissionError;
      }

      console.log('Loaded submission data:', submissionData);

      const formattedSubmission: FormSubmission = {
        id: submissionData.id,
        form_id: submissionData.form_id,
        submitted_at: submissionData.submitted_at,
        submission_data: submissionData.submission_data as Record<string, any>,
        submission_ref_id: submissionData.submission_ref_id,
        form_name: submissionData.forms?.name,
        form_reference_id: submissionData.forms?.reference_id,
        approval_status: submissionData.approval_status,
        approved_by: submissionData.approved_by,
        approval_timestamp: submissionData.approval_timestamp
      };

      setSubmission(formattedSubmission);
      setFormData(formattedSubmission.submission_data || {});

      // Load form structure
      const { data: formData, error: formError } = await supabase
        .from('forms')
        .select(`
          *,
          form_fields(*)
        `)
        .eq('id', submissionData.form_id)
        .single();

      if (formError) {
        console.error('Error loading form:', formError);
        throw formError;
      }

      console.log('Loaded form data:', formData);

      // Helper function to safely parse JSON
      const safeParseJson = (jsonString: any, fallback: any = null) => {
        if (!jsonString) return fallback;
        if (typeof jsonString === 'object') return jsonString;
        
        try {
          return JSON.parse(jsonString);
        } catch (error) {
          console.warn('Failed to parse JSON:', jsonString, error);
          return fallback;
        }
      };

      // Parse pages first to determine field-to-page mapping
      const parsedPages = safeParseJson(formData.pages, [{ id: 'default', name: 'Page 1', order: 0, fields: [] }]);
      
      // Build a map of fieldId -> pageId
      const fieldToPageMap = new Map<string, string>();
      parsedPages.forEach((page: any) => {
        const pageFields = page.fields || [];
        pageFields.forEach((fieldId: string) => {
          fieldToPageMap.set(fieldId, page.id);
        });
      });

      // Transform form data to match Form type
      const transformedForm: Form = {
        id: formData.id,
        name: formData.name,
        description: formData.description || '',
        organizationId: formData.organization_id,
        projectId: formData.project_id,
        status: formData.status as Form['status'],
        fields: (formData.form_fields || [])
          .sort((a: any, b: any) => (a.field_order || 0) - (b.field_order || 0)) // Sort by field_order
          .map((field: any) => ({
          id: field.id,
          type: field.field_type as any,
          label: field.label,
          placeholder: field.placeholder || undefined,
          required: field.required || false,
          defaultValue: field.default_value || undefined,
          options: field.options ? safeParseJson(field.options, []) : undefined,
          validation: field.validation ? safeParseJson(field.validation, {}) : undefined,
          permissions: field.permissions ? safeParseJson(field.permissions, { read: ['*'], write: ['*'] }) : undefined,
          triggers: field.triggers ? safeParseJson(field.triggers, []) : undefined,
          isVisible: field.is_visible !== false,
          isEnabled: field.is_enabled !== false,
          currentValue: field.current_value || undefined,
          tooltip: field.tooltip || undefined,
          errorMessage: field.error_message || undefined,
          // Assign correct pageId based on which page contains this field
          pageId: fieldToPageMap.get(field.id) || parsedPages[0]?.id || 'default',
          customConfig: field.custom_config ? safeParseJson(field.custom_config, {}) : undefined,
        })),
        permissions: safeParseJson(formData.permissions, { view: [], submit: [], edit: [] }),
        createdAt: formData.created_at,
        updatedAt: formData.updated_at,
        createdBy: formData.created_by,
        isPublic: formData.is_public,
        shareSettings: safeParseJson(formData.share_settings, { allowPublicAccess: false, sharedUsers: [] }),
        fieldRules: safeParseJson(formData.field_rules, []),
        formRules: safeParseJson(formData.form_rules, []),
        layout: safeParseJson(formData.layout, { columns: 1 }),
        pages: parsedPages,
      };

      setForm(transformedForm);
      
      // Initialize page navigation
      const pages = transformedForm.pages && transformedForm.pages.length > 0 
        ? transformedForm.pages 
        : [{ id: 'default', name: 'Form', order: 0, fields: transformedForm.fields.map(f => f.id) }];
      
      if (pages.length > 0 && !currentPageId) {
        setCurrentPageId(pages[0].id);
      }
      
      // Check if user can manage approval status (form owners, admins, or users with specific permissions)
      checkApprovalPermissions(submissionData.form_id);
      
      console.log('Form loaded successfully');
    } catch (error) {
      console.error('Error loading submission and form:', error);
      toast({
        title: "Error",
        description: "Failed to load submission details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if user can manage approval status
  const checkApprovalPermissions = async (formId: string) => {
    try {
      // For now, allow all authenticated users to manage approval
      // In production, this should check specific permissions
      setCanManageApproval(true);
      
      // TODO: Implement proper permission checking based on:
      // - Form ownership
      // - Admin roles
      // - Specific approval permissions
    } catch (error) {
      console.error('Error checking approval permissions:', error);
      setCanManageApproval(false);
    }
  };

  // Get approval status badge properties
  const getApprovalStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          variant: 'default' as const,
          className: 'bg-green-500 hover:bg-green-600 text-white border-green-400'
        };
      case 'rejected':
        return {
          variant: 'destructive' as const,
          className: 'bg-red-500 hover:bg-red-600 text-white border-red-400'
        };
      case 'pending':
        return {
          variant: 'secondary' as const,
          className: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-400'
        };
      case 'under_review':
        return {
          variant: 'secondary' as const,
          className: 'bg-blue-500 hover:bg-blue-600 text-white border-blue-400'
        };
      default:
        return {
          variant: 'outline' as const,
          className: 'bg-gray-500 hover:bg-gray-600 text-white border-gray-400'
        };
    }
  };

  // Handle approval status change
  const handleApprovalStatusChange = async (newStatus: string) => {
    if (!submission) return;

    try {
      setSaving(true);
      console.log('Updating approval status to:', newStatus);
      
      const updateData: any = {
        approval_status: newStatus
      };

      // Set approval timestamp and user for approved/rejected statuses
      if (newStatus === 'approved' || newStatus === 'rejected') {
        updateData.approval_timestamp = new Date().toISOString();
        updateData.approved_by = (await supabase.auth.getUser()).data.user?.id;
      } else {
        // Clear approval data for other statuses
        updateData.approval_timestamp = null;
        updateData.approved_by = null;
      }

      const { error } = await supabase
        .from('form_submissions')
        .update(updateData)
        .eq('id', submission.id);

      if (error) {
        console.error('Error updating approval status:', error);
        throw error;
      }

      console.log('Approval status updated successfully');
      
      toast({
        title: "Success",
        description: `Submission ${newStatus === 'approved' ? 'approved' : newStatus === 'rejected' ? 'rejected' : 'status updated'} successfully`,
      });

      // Update local state
      setSubmission(prev => prev ? {
        ...prev,
        approval_status: newStatus,
        approval_timestamp: updateData.approval_timestamp,
        approved_by: updateData.approved_by
      } : null);

    } catch (error) {
      console.error('Error updating approval status:', error);
      toast({
        title: "Error",
        description: "Failed to update approval status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Initialize field states based on edit mode
  const initializeFieldStates = () => {
    if (!form) return;

    const states: Record<string, any> = {};
    form.fields.forEach(field => {
      states[field.id] = {
        isVisible: field.isVisible !== false,
        isEnabled: isEditing ? (field.isEnabled !== false) : false, // Read-only when not editing
        label: field.label,
        options: field.options,
        tooltip: field.tooltip,
        errorMessage: field.errorMessage,
      };
    });
    setFieldStates(states);
  };

  useEffect(() => {
    if (submissionId) {
      loadSubmissionAndForm();
    }
  }, [submissionId]);

  useEffect(() => {
    if (form) {
      initializeFieldStates();
    }
  }, [form, isEditing]);

  const handleFieldChange = (fieldId: string, value: any) => {
    console.log('Field change:', fieldId, value);
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSave = async () => {
    if (!submission) return;

    try {
      setSaving(true);
      console.log('Saving submission with data:', formData);
      
      const { error } = await supabase
        .from('form_submissions')
        .update({
          submission_data: formData
        })
        .eq('id', submission.id);

      if (error) {
        console.error('Error updating submission:', error);
        throw error;
      }

      console.log('Submission updated successfully');
      
      toast({
        title: "Success",
        description: "Submission updated successfully",
      });

      // Update local state
      setSubmission(prev => prev ? {
        ...prev,
        submission_data: formData
      } : null);

      setIsEditing(false);
    } catch (error) {
      console.error('Error updating submission:', error);
      toast({
        title: "Error",
        description: "Failed to update submission. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (submission) {
      setFormData(submission.submission_data || {});
    }
    setIsEditing(false);
  };

  const handleSubmit = async (formData: Record<string, any>) => {
    // Handle form submission - for now just log
    console.log('Form submitted with data:', formData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading submission...</div>
      </div>
    );
  }

  if (!submission || !form) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Submission Not Found</h2>
        <p className="text-muted-foreground mb-4">The submission you're looking for doesn't exist or you don't have access to it.</p>
        {onBack && (
          <Button onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        )}
      </div>
    );
  }

  // Initialize pages for navigation
  const pages = form?.pages && form.pages.length > 0 
    ? form.pages 
    : [{ id: 'default', name: 'Form', order: 0, fields: form?.fields.map(f => f.id) || [] }];
  const currentPageIndex = pages.findIndex(p => p.id === currentPageId);
  const handlePageChange = (pageId: string) => {
    setCurrentPageId(pageId);
  };

  const handleFieldSelect = (field: FormField) => {
    setSelectedField(field);
  };

  const handleFieldHighlight = (fieldId: string) => {
    // Scroll to field if needed
    const fieldElement = document.getElementById(`field-${fieldId}`);
    if (fieldElement) {
      fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="space-y-6 h-full">
      {/* Pagination */}
      {pages.length > 1 && (
        <div className="px-4 py-3 bg-white border rounded-lg">
          <FormPagination
            pages={pages}
            currentPageId={currentPageId}
            currentPageIndex={currentPageIndex}
            onPageChange={handlePageChange}
            onPrevious={() => {
              const currentIndex = pages.findIndex(p => p.id === currentPageId);
              if (currentIndex > 0) {
                handlePageChange(pages[currentIndex - 1].id);
              }
            }}
            onNext={() => {
              const currentIndex = pages.findIndex(p => p.id === currentPageId);
              if (currentIndex < pages.length - 1) {
                handlePageChange(pages[currentIndex + 1].id);
              }
            }}
            readOnly={true}
          />
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between bg-card border rounded-lg px-4 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold">{submission.form_name}</h2>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                <span>ID: {submission.submission_ref_id || submission.id.slice(0, 8)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{new Date(submission.submitted_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
          
            {/* Lifecycle Dropdown Fields */}
          <div className="flex items-center gap-4 ml-4">
            {lifecycleFields.map((field) => (
              <LifecycleStatusBar
                key={field.id}
                field={field}
                value={formData[field.id] || ''}
                onChange={(value) => handleFieldChange(field.id, value)}
                disabled={saving}
                isEditing={isEditing}
                submissionId={submission.id}
              />
            ))}
          </div>
          
        </div>
        
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCancel}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-1" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area with Navigation */}
      <div className={`grid gap-6 h-[calc(100vh-16rem)] ${
        navigationVisible 
          ? 'grid-cols-1 lg:grid-cols-4' 
          : 'grid-cols-1'
      }`}>
        {/* Navigation Panel */}
        <div className={navigationVisible ? "lg:col-span-1" : ""}>
          <FormNavigationPanel
            pages={pages}
            fields={form?.fields || []}
            currentPageId={currentPageId}
            selectedField={selectedField}
            onPageChange={handlePageChange}
            onFieldSelect={handleFieldSelect}
            onFieldHighlight={handleFieldHighlight}
            onToggleNavigation={() => setNavigationVisible(!navigationVisible)}
            isCollapsed={!navigationVisible}
          />
        </div>

        {/* Form Fields - Professional Content */}
        <Card className={`h-full overflow-hidden bg-white dark:bg-gray-950 ${navigationVisible ? "lg:col-span-3" : "lg:col-span-4"}`}>
          <CardHeader className="pb-4 border-b bg-slate-50/80 dark:bg-gray-900/80">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Submission Data
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-full overflow-y-auto">
            {/* Professional Form Content */}
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
              <div className="px-16 py-16 bg-white dark:bg-gray-950 min-h-[500px]">
                <div className="max-w-5xl mx-auto space-y-8">
                  <SubmissionFormRenderer
                    form={form}
                    formData={formData}
                    fieldStates={fieldStates}
                    currentPageId={currentPageId}
                    onFieldChange={handleFieldChange}
                    onSubmit={handleSubmit}
                    formId={form.id}
                    currentSubmissionId={submissionId}
                  />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
