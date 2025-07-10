
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RuleProcessor, RuleProcessingContext } from '@/utils/ruleProcessor';
import { Button } from '@/components/ui/button';
import { Form, FormField } from '@/types/form';
import { FormFieldsRenderer } from './FormFieldsRenderer';
import { FormPagination } from './FormPagination';
import { FormNavigationPanel } from './FormNavigationPanel';
import { Separator } from '@/components/ui/separator';

interface FormPreviewProps {
  form: Form;
  showNavigation?: boolean;
}

export function FormPreview({ form, showNavigation = false }: FormPreviewProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [currentPageId, setCurrentPageId] = useState<string>('');
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [highlightedFieldId, setHighlightedFieldId] = useState<string | null>(null);
  const [navigationVisible, setNavigationVisible] = useState(showNavigation);
  const [fieldStates, setFieldStates] = useState<Record<string, {
    isVisible: boolean;
    isEnabled: boolean;
    label: string;
    options?: any[];
    tooltip?: string;
    errorMessage?: string;
  }>>({});
  const [formLocked, setFormLocked] = useState(false);
  const [submitAllowed, setSubmitAllowed] = useState(true);

  // Initialize pages and current page with proper array checks
  const formFields = Array.isArray(form.fields) ? form.fields : [];
  const pages = Array.isArray(form.pages) && form.pages.length > 0 
    ? form.pages 
    : [{ id: 'default', name: 'Form', order: 0, fields: formFields.map(f => f.id) }];
  const currentPageIndex = Array.isArray(pages) ? pages.findIndex(p => p.id === currentPageId) : -1;

  useEffect(() => {
    if (pages.length > 0 && !currentPageId) {
      setCurrentPageId(pages[0].id);
    }
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

  // Process field rules when form data changes
  useEffect(() => {
    if (!Array.isArray(form.fieldRules) || form.fieldRules.length === 0) return;

    // Start with fresh field states to ensure all fields maintain their visibility
    const newFieldStates: Record<string, any> = {};
    if (Array.isArray(form.fields)) {
      form.fields.forEach(field => {
        newFieldStates[field.id] = {
          isVisible: field.isVisible ?? true,
          isEnabled: field.isEnabled ?? true,
          label: field.label,
          options: field.options,
          tooltip: field.tooltip,
          errorMessage: field.errorMessage,
        };
      });
    }
    
    form.fieldRules.forEach((rule) => {
      if (!rule.isActive) return;

      const conditionField = Array.isArray(form.fields) ? form.fields.find(f => f.id === rule.condition.fieldId) : null;
      const targetField = Array.isArray(form.fields) ? form.fields.find(f => f.id === rule.targetFieldId) : null;
      
      if (!conditionField || !targetField) return;

      const currentValue = formData[rule.condition.fieldId] || '';
      const conditionValue = rule.condition.value;
      
      let conditionMet = false;
      
      // Evaluate condition based on operator
      switch (rule.condition.operator) {
        case '==':
          conditionMet = currentValue === conditionValue;
          break;
        case '!=':
          conditionMet = currentValue !== conditionValue;
          break;
        case 'contains':
          conditionMet = currentValue.toString().toLowerCase().includes(conditionValue.toString().toLowerCase());
          break;
        case 'not contains':
          conditionMet = !currentValue.toString().toLowerCase().includes(conditionValue.toString().toLowerCase());
          break;
        case 'startsWith':
          conditionMet = currentValue.toString().toLowerCase().startsWith(conditionValue.toString().toLowerCase());
          break;
        case 'endsWith':
          conditionMet = currentValue.toString().toLowerCase().endsWith(conditionValue.toString().toLowerCase());
          break;
        case '<':
          conditionMet = Number(currentValue) < Number(conditionValue);
          break;
        case '>':
          conditionMet = Number(currentValue) > Number(conditionValue);
          break;
        case '<=':
          conditionMet = Number(currentValue) <= Number(conditionValue);
          break;
        case '>=':
          conditionMet = Number(currentValue) >= Number(conditionValue);
          break;
        case 'in':
          const values = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
          conditionMet = values.includes(currentValue);
          break;
        default:
          conditionMet = false;
      }

      // Apply action if condition is met
      if (conditionMet) {
        switch (rule.action) {
          case 'show':
            newFieldStates[rule.targetFieldId] = {
              ...newFieldStates[rule.targetFieldId],
              isVisible: true
            };
            break;
          case 'hide':
            newFieldStates[rule.targetFieldId] = {
              ...newFieldStates[rule.targetFieldId],
              isVisible: false
            };
            break;
          case 'enable':
            newFieldStates[rule.targetFieldId] = {
              ...newFieldStates[rule.targetFieldId],
              isEnabled: true
            };
            break;
          case 'disable':
            newFieldStates[rule.targetFieldId] = {
              ...newFieldStates[rule.targetFieldId],
              isEnabled: false
            };
            break;
          case 'changeLabel':
            if (rule.actionValue) {
              newFieldStates[rule.targetFieldId] = {
                ...newFieldStates[rule.targetFieldId],
                label: rule.actionValue.toString()
              };
            }
            break;
          case 'changeOptions':
            if (rule.actionValue && Array.isArray(rule.actionValue)) {
              newFieldStates[rule.targetFieldId] = {
                ...newFieldStates[rule.targetFieldId],
                options: rule.actionValue
              };
            }
            break;
          case 'showTooltip':
            if (rule.actionValue) {
              newFieldStates[rule.targetFieldId] = {
                ...newFieldStates[rule.targetFieldId],
                tooltip: rule.actionValue.toString()
              };
            }
            break;
          case 'showError':
            if (rule.actionValue) {
              newFieldStates[rule.targetFieldId] = {
                ...newFieldStates[rule.targetFieldId],
                errorMessage: rule.actionValue.toString()
              };
            }
            break;
          case 'setDefault':
            if (rule.actionValue) {
              setFormData(prev => ({
                ...prev,
                [rule.targetFieldId]: rule.actionValue
              }));
            }
            break;
          case 'clearValue':
            setFormData(prev => ({
              ...prev,
              [rule.targetFieldId]: ''
            }));
            break;
        }
      } else {
        // Reset to original field state if condition is not met
        const originalField = Array.isArray(form.fields) ? form.fields.find(f => f.id === rule.targetFieldId) : null;
        if (originalField) {
          newFieldStates[rule.targetFieldId] = {
            ...newFieldStates[rule.targetFieldId],
            isVisible: originalField.isVisible,
            isEnabled: originalField.isEnabled,
            label: originalField.label,
            options: originalField.options,
            tooltip: originalField.tooltip,
            errorMessage: originalField.errorMessage,
          };
        }
      }
    });

    setFieldStates(newFieldStates);
  }, [formData, form.fieldRules, form.fields]);

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const getCurrentPageFields = () => {
    const safeFormFields = Array.isArray(form.fields) ? form.fields : [];
    if (!currentPageId || !Array.isArray(pages) || pages.length === 0) return safeFormFields;
    
    const currentPage = pages.find(p => p.id === currentPageId);
    if (!currentPage || !Array.isArray(currentPage.fields)) return safeFormFields;
    
    return safeFormFields.filter(field => currentPage.fields.includes(field.id));
  };

  const handlePageChange = (pageId: string) => {
    setCurrentPageId(pageId);
  };

  const handlePrevious = () => {
    if (Array.isArray(pages) && currentPageIndex > 0) {
      setCurrentPageId(pages[currentPageIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (Array.isArray(pages) && currentPageIndex < pages.length - 1) {
      setCurrentPageId(pages[currentPageIndex + 1].id);
    }
  };

  const handleFieldHighlight = (fieldId: string) => {
    setHighlightedFieldId(fieldId);
    
    // Auto-clear highlight after 3 seconds
    setTimeout(() => {
      setHighlightedFieldId(null);
    }, 3000);
  };

  // Enhanced field rendering logic for proper layout handling
  const renderFieldsWithSmartLayout = () => {
    const currentFields = getCurrentPageFields();
    const columns = (form.layout?.columns as 1 | 2 | 3) || 1;
    const renderedElements: React.ReactNode[] = [];
    let standardFieldsBuffer: FormField[] = [];
    let elementIndex = 0;

    // Check if field is full-width based on type or explicit setting
    const isFullWidthField = (field: FormField) => {
      const fullWidthTypes = ['header', 'description', 'section-break', 'horizontal-line', 'rich-text', 'record-table', 'matrix-grid', 'cross-reference'];
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
                  errors={{}}
                  fieldStates={fieldStates}
                  columns={1}
                  onFieldChange={handleFieldChange}
                  onSubmit={() => {}}
                  showButtons={false}
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
              errors={{}}
              fieldStates={fieldStates}
              columns={1}
              onFieldChange={handleFieldChange}
              onSubmit={() => {}}
              showButtons={false}
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

  const columns = (form.layout?.columns as 1 | 2 | 3) || 1;

  if (showNavigation) {
    return (
      <div className={`grid gap-6 h-[calc(100vh-12rem)] ${
        navigationVisible 
          ? 'grid-cols-1 lg:grid-cols-4' 
          : 'grid-cols-1'
      }`}>
        {/* Navigation Panel */}
        <div className={navigationVisible ? "lg:col-span-1" : ""}>
          <FormNavigationPanel
            pages={Array.isArray(pages) ? pages : []}
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
        
        {/* Professional Preview Content */}
        <div className={navigationVisible ? "lg:col-span-3" : "lg:col-span-4"}>
          <Card className="h-full overflow-hidden bg-white dark:bg-gray-950">
            <CardHeader className="pb-4 border-b bg-slate-50/80 dark:bg-gray-900/80">
              <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Form Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-full overflow-y-auto">
              {/* Professional Form Header with Light Lines */}
              <div className="relative">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                <div className="px-16 py-12 bg-white dark:bg-gray-950">
                  <div className="max-w-5xl mx-auto text-left space-y-4">
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 leading-tight font-['Inter',system-ui,sans-serif]">
                      {form.name}
                    </h1>
                    {form.description && (
                      <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-['Inter',system-ui,sans-serif] font-normal">
                        {form.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
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
              
              {/* Minimalistic Action Buttons */}
              <div className="px-16 py-8 bg-slate-50/40 dark:bg-gray-900/20">
                <div className="max-w-5xl mx-auto">
                  <div className="flex flex-col sm:flex-row gap-3 justify-end">
                    <Button 
                      variant="outline" 
                      size="default"
                      className="px-6 py-2 text-sm font-medium border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 bg-white dark:bg-gray-950 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-200"
                    >
                      Save Draft
                    </Button>
                    <Button 
                      size="default"
                      className="px-6 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 transition-colors duration-200"
                    >
                      Submit Form
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <Card className="h-full overflow-hidden bg-white dark:bg-gray-950">
      <CardHeader className="pb-4 border-b bg-slate-50/80 dark:bg-gray-900/80">
        <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Form Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 h-full overflow-y-auto">
        {/* Professional Form Header with Light Lines */}
        <div className="relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
          <div className="px-16 py-12 bg-white dark:bg-gray-950">
            <div className="max-w-5xl mx-auto text-left space-y-4">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 leading-tight font-['Inter',system-ui,sans-serif]">
                {form.name}
              </h1>
              {form.description && (
                <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-['Inter',system-ui,sans-serif] font-normal">
                  {form.description}
                </p>
              )}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
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
        
        {/* Minimalistic Action Buttons */}
        <div className="px-16 py-8 bg-slate-50/40 dark:bg-gray-900/20">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <Button 
                variant="outline" 
                size="default"
                className="px-6 py-2 text-sm font-medium border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 bg-white dark:bg-gray-950 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-200"
              >
                Save Draft
              </Button>
              <Button 
                size="default"
                className="px-6 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 transition-colors duration-200"
              >
                Submit Form
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
