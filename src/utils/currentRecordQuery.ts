const UPDATE_FORM_HEADER = /^\s*UPDATE\s+FORM\s+['"]([0-9a-fA-F-]{36})['"]\s+SET\s+FIELD\(\s*['"]([0-9a-fA-F-]{36})['"]\s*\)/i;

/** An UPDATE FORM query whose WHERE uses @submission_id writes to the record open in the form. */
export function isCurrentRecordUpdate(query: string): boolean {
  return UPDATE_FORM_HEADER.test(query) && /\bsubmission_id\s*=\s*@submission_id\b/i.test(query);
}

export function updateFormTarget(query: string): { formId: string; fieldId: string } | null {
  const match = query.match(UPDATE_FORM_HEADER);
  return match ? { formId: match[1], fieldId: match[2] } : null;
}

export function hasFieldValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function sameFieldValue(a: unknown, b: unknown): boolean {
  if (!hasFieldValue(a) && !hasFieldValue(b)) return true;
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return String(a) === String(b);
}
