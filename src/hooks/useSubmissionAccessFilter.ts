import { useMemo, useEffect, useState } from 'react';
import { backend as supabase } from '@/services/api';
import { Form, FormField } from '@/types/form';

interface SubmissionAccessData {
  users?: string[];
  groups?: string[];
}

export function useSubmissionAccessFilter(form: Form | null, userId: string | undefined) {
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Find submission-access field in the form
  const submissionAccessField = useMemo(() => {
    if (!form) return null;
    return form.fields.find(field => field.type === 'submission-access') || null;
  }, [form]);

  // Load user's groups and admin status
  useEffect(() => {
    const loadUserData = async () => {
      if (!userId) {
        setUserGroups([]);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Load groups
        const { data: groupData, error: groupError } = await supabase
          .from('group_memberships')
          .select('group_id')
          .eq('member_id', userId)
          .eq('member_type', 'user');

        if (groupError) throw groupError;
        setUserGroups(groupData?.map(gm => gm.group_id) || []);

        // Check if user is admin
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', userId)
          .single();

        if (!profileError && profileData) {
          setIsAdmin(profileData.role === 'admin');
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        setUserGroups([]);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [userId]);

  /**
   * Returns the access level granted to the current user for a submission.
   * - 'admin' = full control (admins / Full Admin level)
   * - 'edit'  = view + edit, no delete
   * - 'view'  = view only
   * - null    = not granted (no access)
   *
   * When no submission-access field exists, access is unrestricted ('admin').
   * When access data is empty (no users/groups selected), access is unrestricted ('admin').
   */
  const getAccessLevel = (submissionData: Record<string, any>): 'admin' | 'edit' | 'view' | null => {
    // Org admins always have full control
    if (isAdmin) return 'admin';

    // No access-control field on this form -> unrestricted
    if (!submissionAccessField) return 'admin';

    const accessData = submissionData?.[submissionAccessField.id] as SubmissionAccessData | undefined;

    // No restrictions configured on this row -> unrestricted
    if (!accessData || (!accessData.users?.length && !accessData.groups?.length)) {
      return 'admin';
    }

    const isInUsers = accessData.users?.includes(userId || '') ?? false;
    const isInGroups = accessData.groups?.some(g => userGroups.includes(g)) ?? false;

    if (!isInUsers && !isInGroups) return null;

    const configured = (submissionAccessField.customConfig as any)?.accessLevel;
    if (configured === 'admin' || configured === 'edit' || configured === 'view') {
      return configured;
    }
    // Default: view-only when configured value is missing/unknown
    return 'view';
  };

  const canViewSubmission = (submissionData: Record<string, any>): boolean =>
    getAccessLevel(submissionData) !== null;

  const canEditSubmission = (submissionData: Record<string, any>): boolean => {
    const lvl = getAccessLevel(submissionData);
    return lvl === 'edit' || lvl === 'admin';
  };

  const canDeleteSubmission = (submissionData: Record<string, any>): boolean =>
    getAccessLevel(submissionData) === 'admin';

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
    getAccessLevel,
    canViewSubmission,
    canEditSubmission,
    canDeleteSubmission,
    filterSubmissions,
    loading,
    hasAccessControl: !!submissionAccessField,
    isAdmin,
  };
}
