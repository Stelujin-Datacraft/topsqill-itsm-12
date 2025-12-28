import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseSLANotificationProps {
  submissionId: string;
  fieldId: string;
  fieldLabel: string;
  currentStage: string;
  slaWarningHours: number | null;
  lastChangedAt: string | null;
  formCreatorId?: string;
}

export function useSLANotification({
  submissionId,
  fieldId,
  fieldLabel,
  currentStage,
  slaWarningHours,
  lastChangedAt,
  formCreatorId
}: UseSLANotificationProps) {
  const { user } = useAuth();

  const checkAndCreateNotification = useCallback(async () => {
    if (!slaWarningHours || !lastChangedAt || !submissionId || !user) return;

    const lastChangeDate = new Date(lastChangedAt);
    const now = new Date();
    const diffHours = (now.getTime() - lastChangeDate.getTime()) / (1000 * 60 * 60);

    // Only create notification if SLA is exceeded
    if (diffHours < slaWarningHours) return;

    // Check if notification already exists for this SLA breach
    const notificationKey = `sla_${submissionId}_${fieldId}_${currentStage}`;
    
    // Get users to notify (form creator and admins)
    const usersToNotify: string[] = [];
    
    if (formCreatorId) {
      usersToNotify.push(formCreatorId);
    }

    // Get admins from the organization
    try {
      const { data: admins, error: adminsError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(10);

      if (!adminsError && admins) {
        admins.forEach(admin => {
          if (!usersToNotify.includes(admin.id)) {
            usersToNotify.push(admin.id);
          }
        });
      }
    } catch (err) {
      console.error('Error fetching admins for SLA notification:', err);
    }

    // Create notifications for each user
    for (const userId of usersToNotify) {
      try {
        // Check if notification already exists
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'sla_warning')
          .contains('data', { key: notificationKey })
          .single();

        if (existingNotification) {
          // Already notified
          continue;
        }

        // Create new notification
        const { error: insertError } = await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            type: 'sla_warning',
            title: 'SLA Warning: Stage Time Exceeded',
            message: `Record has been in "${currentStage}" stage for over ${slaWarningHours} hours. Field: ${fieldLabel}`,
            data: {
              key: notificationKey,
              submissionId,
              fieldId,
              fieldLabel,
              currentStage,
              slaWarningHours,
              exceededAt: now.toISOString()
            }
          });

        if (insertError) {
          console.error('Error creating SLA notification:', insertError);
        } else {
          console.log('SLA notification created for user:', userId);
        }
      } catch (err) {
        console.error('Error processing SLA notification:', err);
      }
    }
  }, [submissionId, fieldId, fieldLabel, currentStage, slaWarningHours, lastChangedAt, user, formCreatorId]);

  // Check on mount and periodically
  useEffect(() => {
    if (!slaWarningHours) return;

    // Initial check
    checkAndCreateNotification();

    // Check every 5 minutes
    const interval = setInterval(checkAndCreateNotification, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [checkAndCreateNotification, slaWarningHours]);

  return { checkAndCreateNotification };
}
