import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { AuditEventType } from './auditLogger';

type FormAuditEventType = Extract<AuditEventType, 
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
  | 'form_access_revoked'
>;

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
 * Logs a form-related audit event to the database
 */
export const logFormAuditEvent = async (entry: FormAuditLogEntry): Promise<boolean> => {
  try {
    const metadata: Record<string, unknown> = {
      form_id: entry.formId,
      form_name: entry.formName,
    };

    if (entry.changes) {
      metadata.changes = entry.changes;
    }

    if (entry.fieldId) {
      metadata.field_id = entry.fieldId;
    }

    if (entry.fieldLabel) {
      metadata.field_label = entry.fieldLabel;
    }

    if (entry.additionalMetadata) {
      Object.assign(metadata, entry.additionalMetadata);
    }

    const { error } = await supabase.from('audit_logs').insert([{
      user_id: entry.userId,
      event_type: entry.eventType,
      event_category: 'form_management',
      description: entry.description || null,
      metadata: metadata as Json,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
    }]);

    if (error) {
      console.error('Failed to log form audit event:', error);
      return false;
    }

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
