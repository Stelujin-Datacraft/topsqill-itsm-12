
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormField } from '@/types/form';
import { FormFieldsRenderer } from './FormFieldsRenderer';
import { FormPagination } from './FormPagination';
import { FormNavigationPanel } from './FormNavigationPanel';
import { CheckCircle, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { PublicHeader } from './PublicHeader';
import { RuleProcessor, RuleProcessingContext } from '@/utils/ruleProcessor';
import { parseFormFields } from '@/utils/fieldReferenceParser';
import { useUniqueFieldValidation } from '@/hooks/useUniqueFieldValidation';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';

interface FormViewLayoutRendererProps {
  form: Form;
  onSubmit: (formData: Record<string, any>) => void;
  showNavigation?: boolean;
  showPublicHeader?: boolean;
}

export function FormViewLayoutRenderer({ 
  form, 
  onSubmit, 
  showNavigation = true,
  showPublicHeader = false 
}: FormViewLayoutRendererProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [currentPageId, setCurrentPageId] = useState<string>('');
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [highlightedFieldId, setHighlightedFieldId] = useState<string | null>(null);
  const [navigationVisible, setNavigationVisible] = useState(showNavigation);
  const [fieldStates, setFieldStates] = useState<Record<string, {
    isVisible: boolean;
    isEnabled: boolean;
    isRequired?: boolean;
    label: string;
    options?: any[];
    tooltip?: string;
    errorMessage?: string;
  }>>({});
  const [formLocked, setFormLocked] = useState(false);
  const [submitAllowed, setSubmitAllowed] = useState(true);
  const { sendTemplateEmail } = useEmailTemplates();

  // Initialize pages with proper type checking
  const pages = Array.isArray(form.pages) && form.pages.length > 0 
    ? form.pages 
    : [{ id: 'default', name: 'Page 1', order: 0, fields: form.fields?.map(f => f.id) || [] }];

  useEffect(() => {
    if (pages.length > 0 && !currentPageId) {
      setCurrentPageId(pages[0].id);
    }


    console.log("---------------------------------------------------------------------------------------------------------------")
    console.log(form)
        console.log("---------------------------------------------------------------------------------------------------------------")

  }, [pages, currentPageId]);

  // Initialize field states
  useEffect(() => {
    const initialStates: Record<string, any> = {};
    if (Array.isArray(form.fields)) {
      form.fields.forEach(field => {
        initialStates[field.id] = {
          isVisible: field.isVisible ?? true,
          isEnabled: field.isEnabled ?? true,
          
          label: field.label,
          options: field.options,
          tooltip: field.tooltip,
          errorMessage: field.errorMessage,
        };
      });
    }
    setFieldStates(initialStates);
  }, [form.fields]);

  // Process rules when form data changes
  useEffect(() => {
    const fieldRules = Array.isArray(form.fieldRules) ? form.fieldRules : [];
    const formRules = Array.isArray(form.formRules) ? form.formRules : [];
    const formFields = Array.isArray(form.fields) ? form.fields : [];

    // Create rule processing context
    const context: RuleProcessingContext = {
      formData,
      formFields,
      setFormData,
      setFieldStates,
      onFormAction: async (action: string, value?: any) => {
        switch (action) {
          case 'allowSubmit':
            setSubmitAllowed(true);
            break;
          case 'preventSubmit':
            setSubmitAllowed(false);
            break;
          case 'lockForm':
            setFormLocked(true);
            break;
          case 'unlockForm':
            setFormLocked(false);
            break;
          case 'redirect':
            if (value && typeof value === 'string') {
              window.location.href = value;
            }
            break;
          case 'changeFormHeader':
            console.log('Change form header:', value);
            break;
          case 'sendEmail':
            try {
              const { templateId, recipients, templateData, emailTemplate } = value;
              
              // Convert recipients array to email strings
              const recipientEmails = recipients.map((r: any) => 
                typeof r === 'string' ? r : r.value
              );

              // Convert templateData array to object
              const templateDataObj = templateData.reduce((acc: Record<string, any>, item: any) => {
                acc[item.key] = item.value;
                return acc;
              }, {});

              // Extract SMTP config ID from the email template's custom_params
              const smtpConfigId = emailTemplate?.custom_params?.smtp_config_id;

              await sendTemplateEmail({
                templateId,
                recipients: recipientEmails,
                templateData: templateDataObj,
                smtpConfigId: smtpConfigId,
                triggerContext: {
                  trigger_type: 'form_rule',
                  form_id: form.id,
                  form_data: formData,
                }
              });
            } catch (error) {
              console.error('Failed to send email via form rule:', error);
            }
            break;
          default:
            console.log('Form action:', action, value);
        }
      }
    };

    // Process field rules
    if (fieldRules.length > 0) {
      const processedStates = RuleProcessor.processFieldRules(fieldRules, context);
      setFieldStates(processedStates);
    }

    // Process form rules
    if (formRules.length > 0) {
      RuleProcessor.processFormRules(formRules, context);
    }
  }, [formData, form.fieldRules, form.formRules, form.fields]);

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));

    // Clear error when user starts typing
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (Array.isArray(form.fields)) {
      form.fields.forEach(field => {
        const value = formData[field.id];
        const fieldState = fieldStates[field.id];

        // Skip validation if field is not visible or not enabled
        if (!fieldState?.isVisible || !fieldState?.isEnabled) {
          return;
        }

        // Required field validation (check both field.required and fieldState.isRequired)
        const isRequired = field.required || fieldState?.isRequired;
        if (isRequired && (!value || value === '')) {
          newErrors[field.id] = `${fieldState?.label || field.label} is required`;
        }

        // Email validation
        if (field.type === 'email' && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            newErrors[field.id] = 'Please enter a valid email address';
          }
        }

        // Number validation
        if (field.type === 'number' && value !== undefined && value !== '') {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            newErrors[field.id] = 'Please enter a valid number';
          } else if (field.validation) {
            if (field.validation.min !== undefined && numValue < field.validation.min) {
              newErrors[field.id] = `Value must be at least ${field.validation.min}`;
            }
            if (field.validation.max !== undefined && numValue > field.validation.max) {
              newErrors[field.id] = `Value must be at most ${field.validation.max}`;
            }
          }
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const { validateUniqueFields, isValidating } = useUniqueFieldValidation();

  const handleFormSubmit = async (submissionData: Record<string, any>) => {
    if (isSubmitting || isValidating) return;

    if (formLocked) {
      toast.error('This form is currently locked and cannot be submitted.');
      return;
    }

    if (!submitAllowed) {
      toast.error('Form submission is currently blocked by rules.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    // Validate unique fields
    const uniqueValidationResults = await validateUniqueFields(
      form.id,
      Array.isArray(form.fields) ? form.fields : [],
      submissionData,
      undefined // No submissionId when creating new submission
    );

    // Check if any unique field validation failed
    const uniqueFieldErrors: Record<string, string> = {};
    let hasUniqueFieldErrors = false;

    Object.entries(uniqueValidationResults).forEach(([fieldId, result]) => {
      if (!result.isValid && result.error) {
        uniqueFieldErrors[fieldId] = result.error;
        hasUniqueFieldErrors = true;
      }
    });

    if (hasUniqueFieldErrors) {
      setErrors(prev => ({ ...prev, ...uniqueFieldErrors }));
      toast.error('Please fix the duplicate value errors before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(submissionData);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async (formDataToSave: Record<string, any>) => {
    try {
      localStorage.setItem(`form-draft-${form.id}`, JSON.stringify(formDataToSave));
      toast.success('Form saved as draft');
    } catch (error) {
      console.error('Error saving form:', error);
      toast.error('Failed to save form');
    }
  };

  const getCurrentPageFields = () => {
    if (!currentPageId || pages.length === 0) return Array.isArray(form.fields) ? form.fields : [];
    
    const currentPage = pages.find(p => p.id === currentPageId);
    if (!currentPage) return Array.isArray(form.fields) ? form.fields : [];
    
    return Array.isArray(form.fields) ? form.fields.filter(field => currentPage.fields.includes(field.id)) : [];
  };

  const handlePageChange = (pageId: string) => {
    setCurrentPageId(pageId);
  };

  const currentPageIndex = Array.isArray(pages) ? pages.findIndex(p => p.id === currentPageId) : -1;

  const handlePrevious = () => {
    if (currentPageIndex > 0) {
      setCurrentPageId(pages[currentPageIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageId(pages[currentPageIndex + 1].id);
    }
  };

  const handleFieldHighlight = (fieldId: string) => {
    setHighlightedFieldId(fieldId);
    
    // Scroll to the field
    const fieldElement = document.getElementById(`field-${fieldId}`);
    if (fieldElement) {
      fieldElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
    }
    
    // Auto-clear highlight after 5 seconds
    setTimeout(() => {
      setHighlightedFieldId(null);
    }, 5000);
  };

  const handlePrint = () => {
    window.print();
    toast.success('Use your browser\'s print dialog to save as PDF');
  };

  // Enhanced field rendering logic for proper layout handling - EXACT COPY from FormPreview
  const renderFieldsWithSmartLayout = () => {
    const currentFields = getCurrentPageFields();
    const columns = (form.layout?.columns as 1 | 2 | 3) || 1;
    const renderedElements: React.ReactNode[] = [];
    let standardFieldsBuffer: FormField[] = [];
    let elementIndex = 0;

    // Create parsed field references for calculated fields
    const allFormFields = Array.isArray(form.fields) 
      ? parseFormFields(form.fields, form.reference_id || form.name || 'form')
      : [];

    // Check if field is full-width based on type or explicit setting
    const isFullWidthField = (field: FormField) => {
      const fullWidthTypes = ['header', 'description', 'section-break', 'horizontal-line', 'rich-text', 'record-table', 
        'cross-reference', 'matrix-grid', 'child-cross-reference', 'approval', 'geo-location', 'query-field', 'workflow-trigger'];
      return fullWidthTypes.includes(field.type) || field.isFullWidth || field.fieldCategory === 'full-width';
    };

    // Flush standard fields into a proper grid
    const flushStandardFields = () => {
      if (standardFieldsBuffer.length > 0) {
        const gridCols = columns === 1 ? 'grid-cols-1' : 
                        columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 
                        'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
        
        renderedElements.push(
          <div key={`standard-grid-${elementIndex++}`} className={`grid ${gridCols} gap-6`}>
            {standardFieldsBuffer.map(field => (
              <div key={field.id} className="space-y-2">
                <FormFieldsRenderer
                  fields={[field]}
                  formData={formData}
                  errors={errors}
                  fieldStates={fieldStates}
                  columns={1}
                  onFieldChange={handleFieldChange}
                  onSubmit={handleFormSubmit}
                  onSave={handleSave}
                  showButtons={false}
                  allFormFields={allFormFields}
                  highlightedFieldId={highlightedFieldId}
                  formId={form.id}
                />
              </div>
            ))}
          </div>
        );
        standardFieldsBuffer = [];
      }
    };

    // Process each field with smart layout logic
    currentFields.forEach((field) => {
      const fieldState = fieldStates[field.id];
      const isVisible = fieldState?.isVisible ?? field.isVisible ?? true;

      if (!isVisible) return;

      if (isFullWidthField(field)) {
        // Flush any buffered standard fields first
        flushStandardFields();
        
        // Render full-width field in its own container
        renderedElements.push(
          <div key={`fullwidth-${field.id}`} className="w-full">
            <FormFieldsRenderer
              fields={[field]}
              formData={formData}
              errors={errors}
              fieldStates={fieldStates}
              columns={1}
              onFieldChange={handleFieldChange}
              onSubmit={handleFormSubmit}
              onSave={handleSave}
              showButtons={false}
              allFormFields={allFormFields}
              highlightedFieldId={highlightedFieldId}
              formId={form.id}
            />
          </div>
        );
      } else {
        // Buffer standard field for grid layout
        standardFieldsBuffer.push(field);
      }
    });

    // Flush any remaining standard fields
    flushStandardFields();

    return renderedElements;
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        {showPublicHeader && <PublicHeader />}
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-green-600 mb-2">Form Submitted Successfully!</h2>
              <p className="text-muted-foreground mb-6">
                Thank you for your submission. We'll get back to you soon.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const mainContent = (
    <div className={`grid gap-6 h-[calc(100vh-12rem)] ${
      navigationVisible 
        ? 'grid-cols-1 lg:grid-cols-4' 
        : 'grid-cols-1'
    }`}>
      {/* Navigation Panel */}
      {showNavigation && (
        <div className={navigationVisible ? "lg:col-span-1" : ""}>
          <FormNavigationPanel
            pages={pages}
            fields={Array.isArray(form.fields) ? form.fields : []}
            currentPageId={currentPageId}
            selectedField={selectedField}
            onPageChange={handlePageChange}
            onFieldSelect={setSelectedField}
            onFieldHighlight={handleFieldHighlight}
            onToggleNavigation={() => setNavigationVisible(!navigationVisible)}
            isCollapsed={!navigationVisible}
          />
        </div>
      )}
      
      {/* Professional Form Content */}
      <div className={navigationVisible && showNavigation ? "lg:col-span-3" : "lg:col-span-4"}>
        <Card className="h-full overflow-hidden bg-white dark:bg-gray-950">
          <CardHeader className="pb-4 border-b bg-slate-50/80 dark:bg-gray-900/80">
           <CardTitle className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 leading-tight font-['Inter',system-ui,sans-serif]">
                    {form.name}
                  </h1>
                  {form.description && (
                    <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-['Inter',system-ui,sans-serif]">
                      {form.description}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handlePrint}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 shrink-0 print:hidden"
                >
                  <FileDown className="h-4 w-4" />
                  Save as PDF
                </Button>
              </div>
            </CardTitle>

          </CardHeader>
          <CardContent className="p-0 h-full overflow-y-auto">
            {/* Professional Form Header with Light Lines */}
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
              {/* <div className="px-16 py-12 bg-white dark:bg-gray-950"> */}
                {/* <div className="max-w-5xl mx-auto text-left space-y-4">
                  <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 leading-tight font-['Inter',system-ui,sans-serif]">
                    {form.name}
                  </h1>
                  {form.description && (
                    <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-['Inter',system-ui,sans-serif] font-normal">
                      {form.description}
                    </p>
                  )}
                </div> */}
              {/* </div> */}
              {/* <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div> */}
            </div>
            
            {/* Page Navigation Section */}
            {pages.length > 1 && (
              <div className="px-16 py-8 bg-white dark:bg-gray-950 border-b border-slate-100 dark:border-slate-800">
                <div className="max-w-5xl mx-auto">
                  <FormPagination
                    pages={pages}
                    currentPageId={currentPageId}
                    currentPageIndex={currentPageIndex}
                    onPageChange={handlePageChange}
                    onPrevious={handlePrevious}
                    onNext={handleNext}
                  />
                </div>
              </div>
            )}
            
            {/* Enhanced Form Fields Section with Light Lines */}
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
              <div className="px-16 py-16 bg-white dark:bg-gray-950 min-h-[500px]">
                <div className="max-w-5xl mx-auto space-y-8">
                  {renderFieldsWithSmartLayout()}
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
            </div>
            
            {/* Action Buttons */}
            <div className="px-16 py-8 bg-slate-50/40 dark:bg-gray-900/20">
              <div className="max-w-5xl mx-auto">
                <div className="flex flex-col sm:flex-row gap-3 justify-end">
                  <Button 
                    variant="outline" 
                    size="default"
                    onClick={() => handleSave(formData)}
                    className="px-6 py-2 text-sm font-medium border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 bg-white dark:bg-gray-950 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-200"
                  >
                    Save Draft
                  </Button>
                  <Button 
                    size="default"
                    onClick={() => handleFormSubmit(formData)}
                    disabled={isSubmitting}
                    className="px-6 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 transition-colors duration-200"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Form'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (showPublicHeader) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-8">
          {mainContent}
        </div>
      </div>
    );
  }

  return mainContent;
}