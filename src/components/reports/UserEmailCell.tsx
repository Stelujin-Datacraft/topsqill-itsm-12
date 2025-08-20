import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface UserEmailCellProps {
  userId: string | null;
  fallbackEmail?: string;
}

export function UserEmailCell({ userId, fallbackEmail }: UserEmailCellProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserEmail = async () => {
      if (!userId) {
        setUserEmail(fallbackEmail || null);
        setLoading(false);
        return;
      }

      try {
        // Get email from user_profiles
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('id', userId)
          .single();

        if (profile) {
          setUserEmail(profile.email);
        } else {
          // Fallback to any provided email or show as anonymous
          setUserEmail(fallbackEmail || null);
        }
      } catch (error) {
        console.error('Error fetching user email:', error);
        setUserEmail(fallbackEmail || null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserEmail();
  }, [userId, fallbackEmail]);

  if (loading) {
    return <Badge variant="outline" className="opacity-70">Loading...</Badge>;
  }

  if (!userEmail) {
    return <Badge variant="outline" className="opacity-70">Anonymous</Badge>;
  }

  return (
    <Badge 
      variant="secondary" 
      className="cursor-pointer hover:opacity-90 bg-success/20 text-success-foreground border-success/30"
      onClick={() => (window.location.href = `mailto:${userEmail}`)}
      title={`Email ${userEmail}`}
    >
      {userEmail}
    </Badge>
  );
}