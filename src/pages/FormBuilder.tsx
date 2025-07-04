
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { FormBuilder } from '@/components/FormBuilder';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useForm } from '@/contexts/FormContext';

const FormBuilderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { forms, setCurrentForm, currentForm } = useForm();
  const [isCreating, setIsCreating] = useState(!id);
  
  useEffect(() => {
    if (id) {
      // Editing existing form
      const form = forms.find(f => f.id === id);
      if (form) {
        setCurrentForm(form);
        setIsCreating(false);
      } else {
        // Form not found, redirect to forms list
        navigate('/forms');
      }
    } else {
      // Creating new form
      setCurrentForm(null);
      setIsCreating(true);
    }
  }, [id, forms, setCurrentForm, navigate]);

  const actions = (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => navigate('/forms')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Forms
      </Button>
    </div>
  );

  const pageTitle = isCreating 
    ? 'Create New Form' 
    : `Edit Form: ${currentForm?.name || 'Loading...'}`;
  
  return (
    <DashboardLayout title={pageTitle} actions={actions}>
      <FormBuilder formId={id} />
    </DashboardLayout>
  );
};

export default FormBuilderPage;
