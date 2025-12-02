import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { FormNavigationPanel } from './FormNavigationPanel';
import { FormPagination } from './FormPagination';
import { PublicHeader } from './PublicHeader';
import { FormFieldRenderer } from './FormFieldRenderer';
import type { Form } from '@/types/form';

interface FormViewLayoutRendererProps {
  form: Form;
  onSubmit: (data: Record<string, any>) => void | Promise<void>;
  showNavigation?: boolean;
  showPublicHeader?: boolean;
  isSubmitting?: boolean;
}

export const FormViewLayoutRenderer: React.FC<FormViewLayoutRendererProps> = ({
  form,
  onSubmit,
  showNavigation = true,
  showPublicHeader = false,
  isSubmitting = false,
}) => {
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const [navigationVisible, setNavigationVisible] = useState(true);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const pages = useMemo(() => {
    const rawPages = (form as any).pages as any[] | undefined;
    if (!rawPages || rawPages.length === 0) {
      return [
        {
          id: 'default',
          name: 'Form',
        },
      ] as any[];
    }
    return [...rawPages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [form]);

  useEffect(() => {
    if (pages.length > 0 && !currentPageId) {
      setCurrentPageId(pages[0].id);
    }
  }, [pages, currentPageId]);

  const currentPageIndex = useMemo(() => {
    return pages.findIndex(p => p.id === currentPageId);
  }, [pages, currentPageId]);

  const handlePageChange = useCallback((pageId: string) => {
    setCurrentPageId(pageId);
    setSelectedField(null);
  }, []);

  const handlePrevious = useCallback(() => {
    if (currentPageIndex > 0) {
      setCurrentPageId(pages[currentPageIndex - 1].id);
    }
  }, [currentPageIndex, pages]);

  const handleNext = useCallback(() => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageId(pages[currentPageIndex + 1].id);
    }
  }, [currentPageIndex, pages]);

  const handleFieldHighlight = useCallback((fieldId: string | null) => {
    setHighlightedField(fieldId);
    if (fieldId) {
      setTimeout(() => setHighlightedField(null), 2000);
    }
  }, []);

  const handleSaveDraft = useCallback(() => {
    try {
      localStorage.setItem(`form-draft-${form.id}`, JSON.stringify(formData));
    } catch (e) {
      console.error('Failed to save draft', e);
    }
  }, [form.id, formData, form]);

  const handleFormSubmit = useCallback(() => {
    onSubmit(formData);
  }, [onSubmit, formData]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const renderFieldsWithSmartLayout = useCallback(() => {
    const fields = Array.isArray((form as any).fields)
      ? ((form as any).fields as any[])
      : [];
    const currentPageFields = fields
      .filter((field) => field.pageId === currentPageId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (currentPageFields.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          No fields on this page
        </div>
      );
    }

    return currentPageFields.map((field) => (
      <div
        key={field.id}
        className={`transition-all duration-300 ${
          highlightedField === field.id
            ? 'ring-2 ring-blue-500 ring-offset-2 rounded-lg'
            : ''
        }`}
      >
        <FormFieldRenderer
          field={field}
          value={formData[field.id]}
          onChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              [field.id]: value,
            }))
          }
          isSelected={selectedField === field.id}
        />
      </div>
    ));
  }, [form, currentPageId, formData, highlightedField, selectedField]);

  const mainContent = (
    <div className={`grid form-print-layout gap-6 h-[calc(100vh-12rem)] print:block ${
      navigationVisible 
        ? 'grid-cols-1 lg:grid-cols-4' 
        : 'grid-cols-1'
    }`}>
      {/* Navigation Panel */}
      {showNavigation && (
        <div className={`print:hidden ${navigationVisible ? 'lg:col-span-1' : ''}`}>
          <FormNavigationPanel
            pages={pages as any}
            fields={Array.isArray((form as any).fields) ? ((form as any).fields as any[]) : []}
            currentPageId={currentPageId as string}
            selectedField={null as any}
            onPageChange={handlePageChange}
            onFieldSelect={() => {}}
            onFieldHighlight={handleFieldHighlight}
            onToggleNavigation={() => setNavigationVisible(!navigationVisible)}
            isCollapsed={!navigationVisible}
          />
        </div>
      )}

      {/* Professional Form Content */}
      <div className={`print:col-span-1 ${navigationVisible && showNavigation ? "lg:col-span-3" : "lg:col-span-4"}`}>
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
                  className="flex items-center gap-2 shrink-0"
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <PublicHeader />
      <div className="container mx-auto px-4 py-8">
        {mainContent}
      </div>
    </div>
  );
};
