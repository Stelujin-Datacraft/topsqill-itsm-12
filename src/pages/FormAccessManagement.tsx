
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from '@/contexts/FormContext';
import { EnhancedFormUserAccess } from '@/components/EnhancedFormUserAccess';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Form } from '@/types/form';

const FormAccessManagement = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { forms, updateForm } = useForm();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && forms.length > 0) {
      const foundForm = forms.find(f => f.id === id);
      setForm(foundForm || null);
    }
    setLoading(false);
  }, [id, forms]);

  const handleUpdateForm = async (updates: Partial<Form>) => {
    if (!form) return;
    
    try {
      await updateForm(form.id, updates);
      setForm(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      console.error('Error updating form:', error);
    }
  };

  const actions = (
    <Button 
      variant="outline" 
      onClick={() => navigate(`/form-builder/${id}`)}
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      Back to Form Builder
    </Button>
  );

  if (loading) {
    return (
      <DashboardLayout title="Access Management" actions={actions}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!form) {
    return (
      <DashboardLayout title="Form Not Found" actions={actions}>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Form Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The form you're looking for doesn't exist or you don't have permission to access it.
            </p>
            <Button onClick={() => navigate('/forms')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Forms
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Access Management" actions={actions}>
      <EnhancedFormUserAccess form={form} onUpdateForm={handleUpdateForm} />
    </DashboardLayout>
  );
};

export default FormAccessManagement;
