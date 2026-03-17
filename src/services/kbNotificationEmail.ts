import { supabase } from '@/integrations/supabase/client';

interface SendKBNotificationEmailParams {
  type: 'approval_request' | 'review_request' | 'approval_response' | 'review_response';
  recipientUserId: string;
  policyName: string;
  policyNumber?: string;
  policyId: string;
  version?: number;
  organizationId: string;
  senderName?: string;
  reviewType?: 'pre' | 'post';
  comment?: string;
  responseStatus?: 'approved' | 'rejected';
}

export async function sendKBNotificationEmail(params: SendKBNotificationEmailParams) {
  try {
    const { data, error } = await supabase.functions.invoke('send-kb-notification-email', {
      body: params,
    });
    if (error) {
      console.warn('⚠️ KB notification email failed (non-blocking):', error.message);
    } else {
      console.log('✅ KB notification email sent:', params.type);
    }
    return data;
  } catch (err: any) {
    // Email is non-blocking - log but don't throw
    console.warn('⚠️ KB notification email error (non-blocking):', err.message);
  }
}
