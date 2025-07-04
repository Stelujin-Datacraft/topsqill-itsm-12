
import { useParams } from 'react-router-dom';
import { FormPreview } from '@/components/FormPreview';
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

  return <FormPreview form={form} showNavigation={true} />;
};

export default PublicFormView;
