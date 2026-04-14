
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from '@/contexts/FormContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { FormPreview } from '@/components/FormPreview';

const FormPreviewPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getFormById } = useForm();

  const form = id ? getFormById(id) : null;

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-destructive mb-2">Form Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The form you're looking for doesn't exist or has been removed.
            </p>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const backButton = (
    <Button variant="outline" size="sm" onClick={() => navigate(`/form-builder/${id}`)}>
      <ArrowLeft className="h-4 w-4 mr-1" />
      Back to Form
    </Button>
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 shrink-0">
        <p className="text-blue-600 text-sm dark:text-blue-300">
          <span className="font-medium text-blue-800 dark:text-blue-200">Preview Mode</span> — Submissions will not be saved.
        </p>
      </div>
      <div className="flex-1 overflow-hidden p-4">
        <FormPreview form={form} showNavigation={true} headerActions={backButton} />
      </div>
    </div>
  );
};

export default FormPreviewPage;
