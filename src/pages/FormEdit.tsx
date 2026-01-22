
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useForm } from '@/contexts/FormContext';
import DashboardLayout from '@/components/DashboardLayout';
import { FormBuilder } from '@/components/FormBuilder';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const FormEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { forms, setCurrentForm, currentForm } = useForm();
  
  useEffect(() => {
    if (id) {
      const form = forms.find(f => f.id === id);
      if (form) {
        console.log('FormEdit: Setting current form to:', form);
        setCurrentForm(form);
      } else {
        console.log('FormEdit: Form not found, redirecting to forms list');
        navigate('/forms');
      }
    }
  }, [id, forms, setCurrentForm, navigate]);

  const actions = (
    <Button variant="outline" onClick={() => navigate('/forms')}>
      <ArrowLeft className="h-4 w-4 mr-2" />
      Back to Forms
    </Button>
  );
  
  return (
    <DashboardLayout title={`Edit Form: ${currentForm?.name || 'Loading...'}`} actions={actions}>
      <FormBuilder formId={id} />
    </DashboardLayout>
  );
};

export default FormEdit;
