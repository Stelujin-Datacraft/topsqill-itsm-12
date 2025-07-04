
import { useParams } from 'react-router-dom';
import { PublicFormView as PublicFormViewComponent } from '@/components/PublicFormView';
import { PublicHeader } from '@/components/PublicHeader';
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
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <div className="container mx-auto px-4 py-8">
        <PublicFormViewComponent form={form} onSubmit={handleFormSubmit} />
      </div>
    </div>
  );
};

export default PublicFormView;
