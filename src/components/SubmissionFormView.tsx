import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Edit, Save, X, Hash, Calendar, Clock } from 'lucide-react';
import { FormFieldsRenderer } from './FormFieldsRenderer';
import { Form } from '@/types/form';
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
}

export function SubmissionFormView({ submissionId, onBack }: SubmissionFormViewProps) {
  const [submission, setSubmission] = useState<FormSubmission | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [fieldStates, setFieldStates] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

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
        form_reference_id: submissionData.forms?.reference_id
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

      // Transform form data to match Form type
      const transformedForm: Form = {
        id: formData.id,
        name: formData.name,
        description: formData.description || '',
        organizationId: formData.organization_id,
        projectId: formData.project_id,
        status: formData.status as Form['status'],
        fields: (formData.form_fields || []).map((field: any) => ({
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
          pageId: 'default',
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
        pages: safeParseJson(formData.pages, [{ id: 'default', name: 'Page 1', order: 0, fields: [] }]),
      };

      setForm(transformedForm);
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

  return (
    <div className="space-y-6 h-full">
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
          {isEditing && (
            <Badge variant="secondary" className="ml-4">Edit Mode</Badge>
          )}
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
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Submission
            </Button>
          )}
        </div>
      </div>

      {/* Form Fields - Scrollable Content */}
      <Card className="flex-1 h-full">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Submission Data</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-280px)] px-6 pb-6">
            <div className="space-y-6">
              <FormFieldsRenderer
                fields={form.fields}
                formData={formData}
                errors={{}}
                fieldStates={fieldStates}
                columns={(form.layout?.columns as 1 | 2 | 3) || 1}
                onFieldChange={handleFieldChange}
                onSubmit={handleSubmit}
                showButtons={false} // Hide submit buttons
                formId={form.id}
                currentSubmissionId={submissionId}
              />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
