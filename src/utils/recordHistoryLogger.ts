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
 * Compares old and new submission data and returns the changes
 */
export function detectRecordChanges(
  oldData: Record<string, any>,
  newData: Record<string, any>,
  fieldLabels: Record<string, string>
): RecordChange[] {
  const changes: RecordChange[] = [];
  
  // Check all keys in both old and new data
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  
  for (const key of allKeys) {
    const oldValue = oldData[key];
    const newValue = newData[key];
    
    // Compare values (stringify for deep comparison)
    const oldStr = oldValue !== undefined && oldValue !== null ? JSON.stringify(oldValue) : null;
    const newStr = newValue !== undefined && newValue !== null ? JSON.stringify(newValue) : null;
    
    if (oldStr !== newStr) {
      changes.push({
        fieldId: key,
        fieldLabel: fieldLabels[key] || key,
        oldValue: formatDisplayValue(oldValue),
        newValue: formatDisplayValue(newValue)
      });
    }
  }
  
  return changes;
}

/**
 * Formats a value for display in the history log
 */
function formatDisplayValue(value: any): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.join(', ');
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
