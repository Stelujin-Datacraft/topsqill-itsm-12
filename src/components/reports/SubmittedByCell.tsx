import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface SubmittedByCellProps {
  submissionData: any;
}

export function SubmittedByCell({ submissionData }: SubmittedByCellProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserEmail = async () => {
      if (!submissionData.submitted_by) {
        setUserEmail(null);
        setLoading(false);
        return;
      }

      try {
        // First try to get email from user_profiles if submitted_by is a UUID
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('id', submissionData.submitted_by)
          .single();

        if (profile) {
          setUserEmail(profile.email);
        } else {
          // If not found in profiles, check if submitted_by is already an email
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(submissionData.submitted_by)) {
            setUserEmail(submissionData.submitted_by);
          } else {
            setUserEmail(null);
          }
        }
      } catch (error) {
        console.error('Error fetching user email:', error);
        setUserEmail(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserEmail();
  }, [submissionData.submitted_by]);

  if (loading) {
    return <Badge variant="outline" className="opacity-70">Loading...</Badge>;
  }

  if (!userEmail) {
    return <Badge variant="outline" className="opacity-70">Anonymous</Badge>;
  }

  return (
    <Badge 
      variant="secondary" 
      className="cursor-pointer hover:opacity-90"
      onClick={() => (window.location.href = `mailto:${userEmail}`)}
      title={`Email ${userEmail}`}
    >
      {userEmail}
    </Badge>
  );
}