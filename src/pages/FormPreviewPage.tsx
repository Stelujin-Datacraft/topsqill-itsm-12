
import { useParams, Link } from 'react-router-dom';
import { useForm } from '@/contexts/FormContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';
import { FormPreview } from '@/components/FormPreview';

const FormPreviewPage = () => {
  const { id } = useParams<{ id: string }>();
  const { getFormById } = useForm();

  const form = id ? getFormById(id) : null;

  if (!form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-primary-foreground font-bold text-2xl">T</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Topsqill</h1>
            <p className="text-muted-foreground">Form Builder Platform</p>
          </div>

          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-red-600 mb-2">Form Not Found</h2>
              <p className="text-muted-foreground mb-6">
                The form you're looking for doesn't exist or has been removed.
              </p>
              
              <div className="space-y-3">
                <Link to="/dashboard" className="block">
                  <Button className="w-full">
                    <Home className="h-4 w-4 mr-2" />
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/dashboard">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 font-medium">Preview Mode</p>
          <p className="text-blue-600 text-sm">This is a preview of your form. Submissions will not be saved.</p>
        </div>
        
        <FormPreview form={form} />
      </div>
    </div>
  );
};

export default FormPreviewPage;
