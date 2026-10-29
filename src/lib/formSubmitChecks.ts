import type { FormField } from '@/types/form';
import { urlProtocolError } from '@/lib/urlFieldValidation';

/** Same comparison the submit path uses for validation.unique. */
export function uniqueValuesMatch(fieldValue: unknown, submissionValue: unknown): boolean {
  if (typeof fieldValue === 'object' && typeof submissionValue === 'object'
    && fieldValue !== null && submissionValue !== null) {
    return JSON.stringify(fieldValue) === JSON.stringify(submissionValue);
  }
  if (typeof fieldValue === 'string' && typeof submissionValue === 'string') {
    return fieldValue.toLowerCase().trim() === submissionValue.toLowerCase().trim();
  }
  return fieldValue === submissionValue;
}

export function prepareSubmissionData(
  fields: Array<{ id: string; validation?: { trim?: boolean } | null }>,
  data: Record<string, any>,
): Record<string, any> {
  const next: Record<string, any> = { ...data };
  for (const field of fields) {
    if (field.validation?.trim && typeof next[field.id] === 'string') {
      next[field.id] = next[field.id].trim();
    }
    delete next[`${field.id}_error`];
  }
  return next;
}

/** Submit-time URL check for the http-or-https protocol option only. */
export function collectHttpUrlErrors(
  fields: FormField[],
  data: Record<string, any>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.type !== 'url') continue;
    if (field.customConfig?.protocolRestriction !== 'http-or-https') continue;
    const value = data[field.id];
    if (value === undefined || value === null || String(value).trim() === '') continue;
    const message = urlProtocolError(
      String(value),
      'http-or-https',
      field.customConfig?.validationMessage,
    );
    if (message) errors[field.id] = message;
  }
  return errors;
}
