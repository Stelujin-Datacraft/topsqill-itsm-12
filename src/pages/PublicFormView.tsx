
import { useParams } from 'react-router-dom';
import { FormViewLayoutRenderer } from '@/components/FormViewLayoutRenderer';
import { FormLoadingView } from '@/components/FormLoadingView';
import { FormErrorView } from '@/components/FormErrorView';
import { useFormLoader } from '@/hooks/useFormLoader';
import { useFormSubmissionHandler } from '@/hooks/useFormSubmissionHandler';

const PublicFormView = () => {
  const { id } = useParams();
  const { form, loading, error } = useFormLoader(id);
  const { handleFormSubmit } = useFormSubmissionHandler(id);

  if (loading) {
    return <FormLoadingView />;
  }

  if (error || !form) {
    return <FormErrorView error={error || 'Form not found'} />;
  }

  return (
    <FormViewLayoutRenderer 
      form={form} 
      onSubmit={handleFormSubmit}
      showNavigation={true}
      showPublicHeader={true}
    />
  );
};

export default PublicFormView;
