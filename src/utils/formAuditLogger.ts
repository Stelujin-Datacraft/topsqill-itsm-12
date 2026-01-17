import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// Independent form audit event types - NOT linked to main audit_logs
export type FormAuditEventType = 
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

interface FormAuditLogEntry {
  userId: string;
  eventType: FormAuditEventType;
  formId: string;
  formName?: string;
  description?: string;
  changes?: Record<string, unknown>;
  fieldId?: string;
  fieldLabel?: string;
  additionalMetadata?: Record<string, unknown>;
}

/**
 * Logs a form-related audit event to the dedicated form_audit_logs table
 * This is INDEPENDENT from the main audit_logs table
 */
export const logFormAuditEvent = async (entry: FormAuditLogEntry): Promise<boolean> => {
  try {
    // Validate required fields
    if (!entry.userId || !entry.formId) {
      console.warn('logFormAuditEvent: Missing required userId or formId', { 
        userId: entry.userId, 
        formId: entry.formId,
        eventType: entry.eventType 
      });
      return false;
    }

    const metadata: Record<string, unknown> = {};

    if (entry.changes) {
      metadata.changes = entry.changes;
    }

    if (entry.additionalMetadata) {
      Object.assign(metadata, entry.additionalMetadata);
    }

    const insertData = {
      user_id: entry.userId,
      event_type: entry.eventType,
      form_id: entry.formId,
      form_name: entry.formName || null,
      field_id: entry.fieldId || null,
      field_label: entry.fieldLabel || null,
      description: entry.description || null,
      changes: entry.changes as Json || null,
      metadata: Object.keys(metadata).length > 0 ? metadata as Json : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
    };

    console.log('logFormAuditEvent: Inserting audit log', { eventType: entry.eventType, formId: entry.formId });

    const { error } = await supabase.from('form_audit_logs').insert([insertData]);

    if (error) {
      console.error('Failed to log form audit event:', error);
      return false;
    }

    console.log('logFormAuditEvent: Successfully logged', entry.eventType);
    return true;
  } catch (error) {
    console.error('Error logging form audit event:', error);
    return false;
  }
};

/**
 * Helper to get a human-readable description of changes
 */
export const describeFormChanges = (updates: Record<string, unknown>): string => {
  const changedFields = Object.keys(updates).filter(key => 
    !['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at'].includes(key)
  );
  
  if (changedFields.length === 0) return 'No changes detected';
  if (changedFields.length === 1) return `Updated ${changedFields[0].replace(/_/g, ' ')}`;
  if (changedFields.length <= 3) return `Updated ${changedFields.join(', ').replace(/_/g, ' ')}`;
  return `Updated ${changedFields.length} properties`;
};
