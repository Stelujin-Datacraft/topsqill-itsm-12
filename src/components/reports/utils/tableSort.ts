/**
 * Safe client-side sort for report table rows.
 * Guards against non-array options, object/array cell values, and NaN comparators
 * that previously blanked the page when clicking column sort.
 */

import { extractComparableValue, extractNumericValue } from '@/utils/filterUtils';

export type TableSortDirection = 'asc' | 'desc';

export function ensureOptionsArray(opts: unknown): any[] {
  if (Array.isArray(opts)) return opts;
  if (typeof opts === 'string') {
    try {
      const parsed = JSON.parse(opts);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return extractComparableValue(value);
  } catch {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
}

const NUMERIC_TYPES = ['number', 'currency', 'slider', 'rating', 'star-rating', 'calculation'];
const DATE_TYPES = ['date', 'datetime', 'date-time', 'time'];
const BOOLEAN_TYPES = ['toggle', 'toggle-switch', 'checkbox', 'yes-no', 'boolean'];
const OPTION_TYPES = [
  'radio',
  'dropdown',
  'select',
  'multi-select',
  'dynamic-dropdown',
  'status',
];

export function compareTableFieldValues(
  aRaw: unknown,
  bRaw: unknown,
  fieldType: string,
  fieldConfig: { options?: unknown } | null | undefined,
  direction: TableSortDirection,
): number {
  const type = (fieldType || '').toLowerCase();
  const options = ensureOptionsArray(fieldConfig?.options);
  const config = { options };

  let aValue: string | number;
  let bValue: string | number;

  if (NUMERIC_TYPES.includes(type)) {
    const aNum = extractNumericValue(aRaw);
    const bNum = extractNumericValue(bRaw);
    if (aNum === null && bNum === null) return 0;
    if (aNum === null) return direction === 'asc' ? 1 : -1;
    if (bNum === null) return direction === 'asc' ? -1 : 1;
    aValue = aNum;
    bValue = bNum;
  } else if (DATE_TYPES.includes(type)) {
    const parseDate = (val: unknown): number | null => {
      if (val === null || val === undefined || val === '' || val === 'N/A') return null;
      const t = new Date(val as any).getTime();
      return Number.isFinite(t) ? t : null;
    };
    const aDate = parseDate(aRaw);
    const bDate = parseDate(bRaw);
    if (aDate === null && bDate === null) return 0;
    if (aDate === null) return direction === 'asc' ? 1 : -1;
    if (bDate === null) return direction === 'asc' ? -1 : 1;
    aValue = aDate;
    bValue = bDate;
  } else if (BOOLEAN_TYPES.includes(type)) {
    const toBool = (v: unknown) =>
      v === true || v === 'true' || v === 1 || v === '1' || v === 'yes' || v === 'Yes' ? 1 : 0;
    aValue = toBool(aRaw);
    bValue = toBool(bRaw);
  } else if (OPTION_TYPES.includes(type)) {
    const aEmpty = aRaw === null || aRaw === undefined || aRaw === '' || aRaw === 'N/A';
    const bEmpty = bRaw === null || bRaw === undefined || bRaw === '' || bRaw === 'N/A';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return direction === 'asc' ? 1 : -1;
    if (bEmpty) return direction === 'asc' ? -1 : 1;
    aValue = extractComparableValue(aRaw, type, config).toLowerCase();
    bValue = extractComparableValue(bRaw, type, config).toLowerCase();
  } else {
    // Objects / arrays / primitives — never call .toLowerCase on non-strings
    const aEmpty = aRaw === null || aRaw === undefined || aRaw === '' || aRaw === 'N/A';
    const bEmpty = bRaw === null || bRaw === undefined || bRaw === '' || bRaw === 'N/A';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return direction === 'asc' ? 1 : -1;
    if (bEmpty) return direction === 'asc' ? -1 : 1;
    aValue = safeString(aRaw).toLowerCase();
    bValue = safeString(bRaw).toLowerCase();
  }

  if (typeof aValue === 'number' && typeof bValue === 'number') {
    if (!Number.isFinite(aValue) && !Number.isFinite(bValue)) return 0;
    if (!Number.isFinite(aValue)) return direction === 'asc' ? 1 : -1;
    if (!Number.isFinite(bValue)) return direction === 'asc' ? -1 : 1;
    const diff = aValue - bValue;
    return direction === 'asc' ? diff : -diff;
  }

  const comparison = String(aValue).localeCompare(String(bValue), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  return direction === 'asc' ? comparison : -comparison;
}

export function sortTableRows<T extends Record<string, any>>(
  rows: T[],
  opts: {
    field: string;
    direction: TableSortDirection;
    formFields?: Array<{ id: string; field_type?: string; type?: string; options?: unknown }>;
    getFieldValue: (row: T, fieldId: string) => unknown;
  },
): T[] {
  const { field, direction, formFields = [], getFieldValue } = opts;
  if (!field || !rows.length) return rows;

  const sortField = formFields.find((f) => f.id === field);
  const fieldType =
    field === 'submitted_at'
      ? 'datetime'
      : field === 'approval_status'
        ? 'text'
        : ((sortField as any)?.field_type || sortField?.type || '');

  const next = [...rows];
  try {
    next.sort((a, b) => {
      try {
        let aRaw: unknown;
        let bRaw: unknown;
        if (field === 'submitted_at') {
          aRaw = a.submitted_at;
          bRaw = b.submitted_at;
        } else if (field === 'approval_status') {
          aRaw = a.approval_status || 'pending';
          bRaw = b.approval_status || 'pending';
        } else {
          aRaw = getFieldValue(a, field);
          bRaw = getFieldValue(b, field);
        }
        return compareTableFieldValues(aRaw, bRaw, fieldType, sortField, direction);
      } catch {
        return 0;
      }
    });
  } catch {
    return rows;
  }
  return next;
}
