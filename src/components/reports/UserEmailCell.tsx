import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Mail } from 'lucide-react';

interface UserEmailCellProps {
  userId: string | null;
  fallbackEmail?: string;
}

export function UserEmailCell({ userId, fallbackEmail }: UserEmailCellProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserEmail = async () => {
      if (!userId) {
        setUserEmail(fallbackEmail || null);
        setLoading(false);
        return;
      }

      try {
        // Get email + name from user_profiles
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email, first_name, last_name')
          .eq('id', userId)
          .single();

        if (profile) {
          setUserEmail(profile.email);
          const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null;
          setDisplayName(name);
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

  const label = displayName || userEmail;
  const initials = (displayName
    ? displayName.split(/\s+/).map(p => p[0]).join('')
    : userEmail[0]
  ).slice(0, 2).toUpperCase();

  return (
    <div
      className="flex items-center gap-2 cursor-pointer group/user min-w-0"
      onClick={() => (window.location.href = `mailto:${userEmail}`)}
      title={`Email ${userEmail}`}
    >
      <div className="w-7 h-7 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-semibold group-hover/user:scale-110 transition-transform duration-200">
        {initials || '?'}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-foreground truncate group-hover/user:text-primary transition-colors">
          {label}
        </div>
        {displayName && (
          <div className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
            <Mail className="h-2.5 w-2.5" />
            <span className="truncate">{userEmail}</span>
          </div>
        )}
      </div>
    </div>
  );
}