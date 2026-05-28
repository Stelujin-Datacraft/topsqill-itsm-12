import { supabase } from '@/integrations/supabase/client';

interface RecordChange {
  fieldId: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
}

interface LogRecordChangesParams {
  submissionId: string;
  changes: RecordChange[];
  changedBy: string;
  changeType?: 'created' | 'updated' | 'deleted';
}

/**
 * Lookup maps used to resolve raw IDs into human-readable labels
 * when logging changes to the record history.
 */
export interface HistoryLookupMaps {
  getUserDisplayName?: (id: string) => string;
  getGroupDisplayName?: (id: string) => string;
  getRecordDisplay?: (id: string) => string;
}

/**
 * Logs field-level changes to a form submission record
 */
export async function logRecordFieldChanges({
  submissionId,
  changes,
  changedBy,
  changeType = 'updated'
}: LogRecordChangesParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (changes.length === 0) {
      return { success: true };
    }

    const historyRecords = changes.map(change => ({
      submission_id: submissionId,
      field_id: change.fieldId,
      field_label: change.fieldLabel,
      old_value: change.oldValue,
      new_value: change.newValue,
      changed_by: changedBy,
      change_type: changeType
    }));

    const { error } = await supabase
      .from('record_field_history')
      .insert(historyRecords);

    if (error) {
      console.error('Error logging record field changes:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception logging record field changes:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Compares old and new submission data and returns the changes.
 *
 * When `fields` (and optional `lookups`) are provided we render values into
 * their human-readable form (option labels, user/group names, file names,
 * users/groups objects for submission-access, etc.) instead of raw IDs/JSON.
 */
export function detectRecordChanges(
  oldData: Record<string, any>,
  newData: Record<string, any>,
  fieldLabels: Record<string, string>,
  fields?: any[],
  lookups?: HistoryLookupMaps
): RecordChange[] {
  const changes: RecordChange[] = [];

  const fieldMap = new Map<string, any>();
  (fields || []).forEach((f) => {
    if (f?.id) fieldMap.set(f.id, f);
  });

  // Check all keys in both old and new data
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    const oldValue = oldData[key];
    const newValue = newData[key];

    // Compare values (stringify for deep comparison)
    const oldStr = oldValue !== undefined && oldValue !== null ? JSON.stringify(oldValue) : null;
    const newStr = newValue !== undefined && newValue !== null ? JSON.stringify(newValue) : null;

    if (oldStr !== newStr) {
      const field = fieldMap.get(key);
      changes.push({
        fieldId: key,
        fieldLabel: fieldLabels[key] || key,
        oldValue: formatDisplayValue(oldValue, field, lookups),
        newValue: formatDisplayValue(newValue, field, lookups),
      });
    }
  }

  return changes;
}

/**
 * Formats a value for display in the history log.
 * When a field definition is provided we try to resolve IDs into labels.
 */
export function formatDisplayValue(
  value: any,
  field?: any,
  lookups?: HistoryLookupMaps
): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const type = field?.type || field?.field_type;

  // Helper: resolve an option ID to its label for the given field
  const optionsList: any[] = Array.isArray(field?.options) ? field.options : [];
  const labelForOption = (v: any): string => {
    const match = optionsList.find(
      (o) => String(o?.value ?? o?.id ?? o) === String(v)
    );
    return match ? String(match.label ?? match.name ?? match.value ?? v) : String(v);
  };

  // Options-based fields
  if (type === 'select' || type === 'radio') {
    if (optionsList.length) return labelForOption(value);
  }
  if (type === 'multi-select' || type === 'checkbox' || type === 'tags') {
    const arr = Array.isArray(value) ? value : [value];
    if (optionsList.length) return arr.map(labelForOption).join(', ');
    return arr.map(String).join(', ');
  }

  // User picker
  if (type === 'user-picker' && lookups?.getUserDisplayName) {
    const arr = Array.isArray(value) ? value : [value];
    return arr.filter(Boolean).map((id) => lookups.getUserDisplayName!(String(id))).join(', ');
  }

  // Group picker
  if (type === 'group-picker' && lookups?.getGroupDisplayName) {
    const arr = Array.isArray(value) ? value : [value];
    return arr.filter(Boolean).map((id) => lookups.getGroupDisplayName!(String(id))).join(', ');
  }

  // Cross-reference / child-cross-reference: usually stores ref IDs or arrays
  if (type === 'cross-reference' || type === 'child-cross-reference') {
    const arr = Array.isArray(value) ? value : [value];
    if (lookups?.getRecordDisplay) {
      return arr.filter(Boolean).map((id) => lookups.getRecordDisplay!(String(id))).join(', ');
    }
    return arr.map((v) => (typeof v === 'object' ? v?.submission_ref_id || v?.id || JSON.stringify(v) : String(v))).join(', ');
  }

  // Submission-access: { users: string[], groups: string[] }
  if (type === 'submission-access' && value && typeof value === 'object') {
    const usersArr: string[] = Array.isArray(value.users) ? value.users : [];
    const groupsArr: string[] = Array.isArray(value.groups) ? value.groups : [];
    const userNames = lookups?.getUserDisplayName
      ? usersArr.map((id) => lookups.getUserDisplayName!(id))
      : usersArr;
    const groupNames = lookups?.getGroupDisplayName
      ? groupsArr.map((id) => lookups.getGroupDisplayName!(id))
      : groupsArr;
    const parts: string[] = [];
    if (userNames.length) parts.push(`Users: ${userNames.join(', ')}`);
    if (groupNames.length) parts.push(`Groups: ${groupNames.join(', ')}`);
    return parts.length ? parts.join(' | ') : null;
  }

  // File field — show file name(s)
  if (type === 'file' || type === 'image') {
    const fileName = (v: any) => {
      if (!v) return '';
      if (typeof v === 'string') return v.split('/').pop() || v;
      return v.name || v.fileName || (v.url ? String(v.url).split('/').pop() : 'File');
    };
    const arr = Array.isArray(value) ? value : [value];
    return arr.map(fileName).filter(Boolean).join(', ');
  }

  // Address: format from common shape if available
  if (type === 'address' && value && typeof value === 'object') {
    const parts = [value.street, value.city, value.state, value.country, value.postalCode]
      .filter(Boolean);
    if (parts.length) return parts.join(', ');
  }

  // Currency: { amount, currency }
  if (type === 'currency' && value && typeof value === 'object') {
    if (value.amount !== undefined) return `${value.amount} ${value.currency || ''}`.trim();
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
    }
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Fetches the record history for a specific submission
 */
export async function fetchRecordHistory(submissionId: string) {
  const { data, error } = await supabase
    .from('record_field_history')
    .select(`
      id,
      field_id,
      field_label,
      old_value,
      new_value,
      changed_by,
      changed_at,
      change_type
    `)
    .eq('submission_id', submissionId)
    .order('changed_at', { ascending: false });

  if (error) {
    console.error('Error fetching record history:', error);
    return { data: null, error };
  }

  return { data, error: null };
}
