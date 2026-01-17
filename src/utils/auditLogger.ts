import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type AuditEventCategory = 
  | 'security' 
  | 'authentication' 
  | 'user_management' 
  | 'data_access' 
  | 'system'
  | 'form_management';

export type AuditEventType = 
  // Authentication events
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_changed'
  | 'password_reset_requested'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'mfa_verified'
  | 'mfa_failed'
  // Session events
  | 'session_created'
  | 'session_terminated'
  | 'all_sessions_terminated'
  | 'session_expired'
  // Security events
  | 'account_locked'
  | 'account_unlocked'
  | 'suspicious_activity'
  | 'ip_blocked'
  | 'access_denied'
  // User management events
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'role_assigned'
  | 'role_removed'
  | 'permissions_updated'
  // Settings events
  | 'mfa_settings_updated'
  | 'security_settings_updated'
  | 'profile_updated'
  // Form management events
  | 'form_created'
  | 'form_updated'
  | 'form_deleted'
  | 'form_duplicated'
  | 'form_published'
  | 'form_archived'
  | 'form_field_added'
  | 'form_field_updated'
  | 'form_field_deleted'
  | 'form_fields_reordered'
  | 'form_settings_changed'
  | 'form_permissions_changed'
  | 'form_access_granted'
  | 'form_access_revoked';

interface AuditLogEntry {
  userId?: string;
  eventType: AuditEventType;
  eventCategory: AuditEventCategory;
  description?: string;
  metadata?: Json;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Logs an audit event to the database
 */
export const logAuditEvent = async (entry: AuditLogEntry): Promise<boolean> => {
  try {
    const { error } = await supabase.from('audit_logs').insert([{
      user_id: entry.userId || null,
      event_type: entry.eventType,
      event_category: entry.eventCategory,
      description: entry.description || null,
      metadata: entry.metadata || {},
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : null)
    }]);

    if (error) {
      console.error('Failed to log audit event:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error logging audit event:', error);
    return false;
  }
};

/**
 * Fetches audit logs for a specific user
 */
export const getUserAuditLogs = async (
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    eventTypes?: AuditEventType[];
    eventCategories?: AuditEventCategory[];
    startDate?: Date;
    endDate?: Date;
  }
) => {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.eventTypes?.length) {
      query = query.in('event_type', options.eventTypes);
    }

    if (options?.eventCategories?.length) {
      query = query.in('event_category', options.eventCategories);
    }

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    return { data, count };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return { data: null, count: 0 };
  }
};

/**
 * Fetches all audit logs (admin only)
 */
export const getAllAuditLogs = async (
  options?: {
    limit?: number;
    offset?: number;
    eventTypes?: AuditEventType[];
    eventCategories?: AuditEventCategory[];
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }
) => {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (options?.userId) {
      query = query.eq('user_id', options.userId);
    }

    if (options?.eventTypes?.length) {
      query = query.in('event_type', options.eventTypes);
    }

    if (options?.eventCategories?.length) {
      query = query.in('event_category', options.eventCategories);
    }

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    return { data, count };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return { data: null, count: 0 };
  }
};
