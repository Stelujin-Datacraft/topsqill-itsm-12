
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from '@/contexts/FormContext';
import { supabase } from '@/integrations/supabase/client';

interface FormOption {
  id: string;
  name: string;
}

interface FormSelectorProps {
  value?: string;
  onValueChange: (formId: string, formName: string) => void;
  placeholder?: string;
  projectId?: string; // Optional - if provided, fetch forms from this project
}

export function FormSelector({ value, onValueChange, placeholder = "Select a form", projectId }: FormSelectorProps) {
  const { forms: contextForms } = useForm();
  const [selectedForm, setSelectedForm] = useState(value);
  const [projectForms, setProjectForms] = useState<FormOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch forms from specific project if projectId is provided
  useEffect(() => {
    const fetchProjectForms = async () => {
      if (!projectId) {
        setProjectForms([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('forms')
          .select('id, name')
          .eq('project_id', projectId)
          .in('status', ['active', 'published'])
          .order('name');

        if (error) {
          console.error('Error fetching forms for project:', error);
          setProjectForms([]);
        } else {
          setProjectForms(data || []);
        }
      } catch (err) {
        console.error('Error fetching project forms:', err);
        setProjectForms([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectForms();
  }, [projectId]);

  useEffect(() => {
    setSelectedForm(value);
  }, [value]);

  // Use project-specific forms if projectId is provided and forms are loaded, otherwise use context forms
  const forms = projectId && projectForms.length > 0 
    ? projectForms 
    : contextForms.map(f => ({ id: f.id, name: f.name }));

  const handleValueChange = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    if (form) {
      setSelectedForm(formId);
      onValueChange(formId, form.name);
    }
  };

  return (
    <Select value={selectedForm} onValueChange={handleValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={loading ? "Loading forms..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {forms.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground">
            {loading ? "Loading..." : "No forms available"}
          </div>
        ) : (
          forms.map((form) => (
            <SelectItem key={form.id} value={form.id}>
              {form.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
