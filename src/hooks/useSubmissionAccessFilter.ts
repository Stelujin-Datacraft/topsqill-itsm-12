import { useMemo, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormField } from '@/types/form';

interface SubmissionAccessData {
  users?: string[];
  groups?: string[];
}

export function useSubmissionAccessFilter(form: Form | null, userId: string | undefined) {
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Find submission-access field in the form
  const submissionAccessField = useMemo(() => {
    if (!form) return null;
    return form.fields.find(field => field.type === 'submission-access') || null;
  }, [form]);

  // Load user's groups
  useEffect(() => {
    const loadUserGroups = async () => {
      if (!userId) {
        setUserGroups([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('group_memberships')
          .select('group_id')
          .eq('member_id', userId)
          .eq('member_type', 'user');

        if (error) throw error;
        setUserGroups(data?.map(gm => gm.group_id) || []);
      } catch (error) {
        console.error('Error loading user groups:', error);
        setUserGroups([]);
      } finally {
        setLoading(false);
      }
    };

    loadUserGroups();
  }, [userId]);

  /**
   * Filter submissions based on submission-access field
   * Returns true if user can see the submission
   */
  const canViewSubmission = (submissionData: Record<string, any>): boolean => {
    // If no submission-access field exists, all users can see all submissions
    if (!submissionAccessField) {
      return true;
    }

    const accessData = submissionData[submissionAccessField.id] as SubmissionAccessData | undefined;

    // If no access data or empty, all users can see it
    if (!accessData || (!accessData.users?.length && !accessData.groups?.length)) {
      return true;
    }

    // Check if current user is in the selected users
    if (accessData.users?.includes(userId || '')) {
      return true;
    }

    // Check if current user is in any of the selected groups
    if (accessData.groups?.some(groupId => userGroups.includes(groupId))) {
      return true;
    }

    // User is not authorized to view this submission
    return false;
  };

  /**
   * Filter array of submissions based on access control
   */
  const filterSubmissions = <T extends { submission_data: Record<string, any> }>(
    submissions: T[]
  ): T[] => {
    // If no submission-access field, return all submissions
    if (!submissionAccessField) {
      return submissions;
    }

    return submissions.filter(submission => canViewSubmission(submission.submission_data));
  };

  return {
    submissionAccessField,
    canViewSubmission,
    filterSubmissions,
    loading,
    hasAccessControl: !!submissionAccessField
  };
}
