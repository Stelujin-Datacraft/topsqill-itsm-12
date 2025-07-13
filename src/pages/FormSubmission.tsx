
import { useParams } from 'react-router-dom';
import { PublicFormSubmissionView } from '@/components/PublicFormSubmissionView';
import { PublicHeader } from '@/components/PublicHeader';
import { FormLoadingView } from '@/components/FormLoadingView';
import { FormErrorView } from '@/components/FormErrorView';
import { FormReferenceTag } from '@/components/FormReferenceTag';
import { FormSubmissionSuccess } from '@/components/FormSubmissionSuccess';
import { useFormLoader } from '@/hooks/useFormLoader';
import { useFormSubmissionHandler } from '@/hooks/useFormSubmissionHandler';
import { useState } from 'react';

const FormSubmission = () => {
  const { id } = useParams();
  const { form, loading, error } = useFormLoader(id);
  const { handleFormSubmit } = useFormSubmissionHandler(id, form);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionRefId, setSubmissionRefId] = useState<string>();
  const [submissionId, setSubmissionId] = useState<string>();

  if (loading) {
    return <FormLoadingView />;
  }

  if (error || !form) {
    return <FormErrorView error={error || 'Form not found'} />;
  }

  const handleSubmit = async (formData: Record<string, any>) => {
    try {
      const result = await handleFormSubmit(formData);
      setSubmissionRefId(result?.submissionRefId);
      setSubmissionId(result?.submissionId);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-8">
          <FormSubmissionSuccess 
            submissionRefId={submissionRefId}
            submissionId={submissionId}
            formName={form.name}
            onClose={() => setIsSubmitted(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <div className="container mx-auto px-4 py-8">
        {/* Form Reference Tag */}
        <div className="mb-4 flex justify-center">
          <FormReferenceTag referenceId={form.reference_id || form.id.slice(0, 8)} />
        </div>
        
        <PublicFormSubmissionView form={form} onSubmit={handleSubmit} />
      </div>
    </div>
  );
};

export default FormSubmission;
