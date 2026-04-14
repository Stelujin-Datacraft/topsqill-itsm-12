
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from '@/contexts/FormContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { FormPreview } from '@/components/FormPreview';
import DashboardLayout from '@/components/DashboardLayout';

const FormPreviewPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getFormById } = useForm();

  const form = id ? getFormById(id) : null;

  const headerActions = (
    <Button variant="outline" onClick={() => navigate('/dashboard')}>
      <ArrowLeft className="h-4 w-4 mr-2" />
      Back to Dashboard
    </Button>
  );

  if (!form) {
    return (
      <DashboardLayout title="Form Not Found" actions={headerActions}>
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-destructive mb-2">Form Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The form you're looking for doesn't exist or has been removed.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Preview: ${form.name}`} actions={headerActions}>
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
          <p className="text-blue-800 font-medium dark:text-blue-200">Preview Mode</p>
          <p className="text-blue-600 text-sm dark:text-blue-300">This is a preview of your form. Submissions will not be saved.</p>
        </div>
        
        <FormPreview form={form} />
      </div>
    </DashboardLayout>
  );
};

export default FormPreviewPage;
