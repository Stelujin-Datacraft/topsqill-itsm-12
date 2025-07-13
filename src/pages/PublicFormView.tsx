
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { FormViewLayoutRenderer } from '@/components/FormViewLayoutRenderer';
import { FormSubmissionSuccess } from '@/components/FormSubmissionSuccess';
import { FormLoadingView } from '@/components/FormLoadingView';
import { FormErrorView } from '@/components/FormErrorView';
import { useFormWithFields } from '@/hooks/useFormWithFields';
import { useFormSubmissionHandler } from '@/hooks/useFormSubmissionHandler';

const PublicFormView = () => {
  const { id } = useParams();
  const [submissionResult, setSubmissionResult] = useState<{submissionId: string, submissionRefId: string} | null>(null);
  const { form, loading, error } = useFormWithFields(id);
  const { handleFormSubmit } = useFormSubmissionHandler(id, form);

  if (loading) {
    return <FormLoadingView />;
  }

  if (error || !form) {
    return <FormErrorView error={error || 'Form not found'} />;
  }

  // Show submission success if form was submitted
  if (submissionResult) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <FormSubmissionSuccess 
            submissionRefId={submissionResult.submissionRefId}
            submissionId={submissionResult.submissionId}
            formName={form.name}
            onClose={() => setSubmissionResult(null)}
          />
        </div>
      </div>
    );
  }

  const onFormSubmit = async (formData: Record<string, any>) => {
    try {
      const result = await handleFormSubmit(formData);
      setSubmissionResult(result);
    } catch (error) {
      console.error('Form submission failed:', error);
    }
  };

  return (
    <FormViewLayoutRenderer 
      form={form} 
      onSubmit={onFormSubmit}
      showNavigation={true}
      showPublicHeader={true}
    />
  );
};

export default PublicFormView;
