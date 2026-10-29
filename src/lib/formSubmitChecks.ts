import type { FormField } from '@/types/form';
import { DURATION_LIBRARY_KEYS, SINGLE_PARENT_LIBRARY_KEYS } from '@/lib/grc/foundationCatalog';
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

const SINGLE_PARENT_KEYS = new Set<string>(SINGLE_PARENT_LIBRARY_KEYS);
const DURATION_KEYS = new Set<string>(DURATION_LIBRARY_KEYS);
const DURATION_WITH_UNIT = /^\d+(?:\.\d+)?\s+(?:minutes?|hours?|days?|weeks?|months?)$/i;

/**
 * Parent links are cross-reference arrays.
 * The picker can select several records; these library keys allow one parent.
 */
export function collectSingleParentReferenceErrors(
  fields: Array<{ id: string; label?: string; customConfig?: { libraryKey?: string } | null }>,
  data: Record<string, any>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const key = field.customConfig?.libraryKey;
    if (!key || !SINGLE_PARENT_KEYS.has(key)) continue;
    const value = data[field.id];
    if (Array.isArray(value) && value.length > 1) {
      errors[field.id] = `Select one ${field.label || 'record'}.`;
    }
  }
  return errors;
}

/** Duration text must include a unit. Amounts with a minimum reject smaller numbers. */
export function collectFoundationValueErrors(
  fields: Array<{
    id: string;
    label?: string;
    type?: string;
    validation?: { min?: number } | null;
    customConfig?: { libraryKey?: string } | null;
  }>,
  data: Record<string, any>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = data[field.id];
    const key = field.customConfig?.libraryKey;
    if (key && DURATION_KEYS.has(key) && typeof value === 'string' && value.trim() && !DURATION_WITH_UNIT.test(value.trim())) {
      errors[field.id] = `${field.label || 'Duration'} must include a number and a unit, for example 4 hours.`;
    }
    if (field.type === 'number' && field.validation?.min !== undefined && value !== undefined && value !== null && value !== '') {
      const numeric = Number(value);
      if (!Number.isNaN(numeric) && numeric < field.validation.min) {
        errors[field.id] = field.validation.min === 0
          ? 'Amount must be zero or greater.'
          : `Value must be at least ${field.validation.min}`;
      }
    }
  }
  return errors;
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
