
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface FormSubmission {
  id: string;
  form_id: string;
  submitted_by: string;
  submitted_at: string;
  submission_data: Record<string, any>;
  approval_status?: string;
  approved_by?: string;
  approval_timestamp?: string;
  ip_address?: string;
  user_agent?: string;
}

interface DatabaseSubmission {
  id: string;
  form_id: string;
  submitted_by: string;
  submitted_at: string;
  submission_data: any; // This is Json type from Supabase
  approval_status?: string;
  approved_by?: string;
  approval_timestamp?: string;
  ip_address?: unknown;
  user_agent?: string;
  approval_notes?: string;
}

export function useFormSubmissionData(formId?: string) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSubmissions = async (selectedFormId: string) => {
    if (!selectedFormId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', selectedFormId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      // Convert database response to our interface
      const formattedSubmissions: FormSubmission[] = (data as DatabaseSubmission[])?.map(submission => ({
        id: submission.id,
        form_id: submission.form_id,
        submitted_by: submission.submitted_by,
        submitted_at: submission.submitted_at,
        submission_data: typeof submission.submission_data === 'string' 
          ? JSON.parse(submission.submission_data) 
          : submission.submission_data || {},
        approval_status: submission.approval_status,
        approved_by: submission.approved_by,
        approval_timestamp: submission.approval_timestamp,
        ip_address: submission.ip_address?.toString(),
        user_agent: submission.user_agent,
      })) || [];

      setSubmissions(formattedSubmissions);
    } catch (error) {
      console.error('Error loading submissions:', error);
      toast({
        title: "Error",
        description: "Failed to load form submissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (formId) {
      loadSubmissions(formId);
    }
  }, [formId]);

  return {
    submissions,
    loading,
    loadSubmissions
  };
}
