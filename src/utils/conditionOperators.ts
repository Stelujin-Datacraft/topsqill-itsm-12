import type { ComparisonOperator } from '@/types/conditions';

/** Operators available for a given form field type (shared by Condition UI + AI resolver). */
export function getOperatorsForFieldType(
  fieldType: string,
): Array<{ value: ComparisonOperator; label: string }> {
  const normalizedType = (fieldType || '').toLowerCase().replace(/[_\s]/g, '-');

  const baseOperators: Array<{ value: ComparisonOperator; label: string }> = [
    { value: '==', label: 'Equals' },
    { value: '!=', label: 'Not Equals' },
    { value: 'exists', label: 'Has Value' },
    { value: 'not_exists', label: 'Is Empty' },
  ];

  const textOperators: Array<{ value: ComparisonOperator; label: string }> = [
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does Not Contain' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' },
  ];

  const dateTimeOperators: Array<{ value: ComparisonOperator; label: string }> = [
    { value: 'after', label: 'After' },
    { value: 'before', label: 'Before' },
    { value: 'on_or_after', label: 'On or After' },
    { value: 'on_or_before', label: 'On or Before' },
    { value: 'between', label: 'Between' },
    { value: 'is_today', label: 'Is Today' },
    { value: 'is_yesterday', label: 'Is Yesterday' },
    { value: 'is_tomorrow', label: 'Is Tomorrow' },
    { value: 'is_current_week', label: 'Is Current Week' },
    { value: 'is_last_week', label: 'Is Last Week' },
    { value: 'is_next_week', label: 'Is Next Week' },
    { value: 'is_current_month', label: 'Is Current Month' },
    { value: 'is_last_month', label: 'Is Last Month' },
    { value: 'is_next_month', label: 'Is Next Month' },
    { value: 'is_current_year', label: 'Is Current Year' },
    { value: 'is_last_year', label: 'Is Last Year' },
    { value: 'last_n_days', label: 'Last N Days' },
    { value: 'next_n_days', label: 'Next N Days' },
  ];

  const timeOnlyOperators: Array<{ value: ComparisonOperator; label: string }> = [
    { value: 'after', label: 'After' },
    { value: 'before', label: 'Before' },
    { value: 'on_or_after', label: 'On or After' },
    { value: 'on_or_before', label: 'On or Before' },
    { value: 'between', label: 'Between' },
  ];

  const numericOperators: Array<{ value: ComparisonOperator; label: string }> = [
    { value: '>', label: 'Greater Than' },
    { value: '<', label: 'Less Than' },
    { value: '>=', label: 'Greater or Equal' },
    { value: '<=', label: 'Less or Equal' },
    { value: 'between', label: 'Between' },
  ];

  if (normalizedType === 'date') return [...baseOperators, ...dateTimeOperators];
  if (normalizedType === 'datetime' || normalizedType === 'date-time' || normalizedType === 'datetime-local') {
    return [...baseOperators, ...dateTimeOperators];
  }
  if (normalizedType === 'time') return [...baseOperators, ...timeOnlyOperators];
  if (['number', 'currency', 'slider', 'range', 'rating', 'star-rating', 'starrating'].includes(normalizedType)) {
    return [...baseOperators, ...numericOperators];
  }
  if (['text', 'textarea', 'email', 'url', 'phone', 'phonenumber', 'phone-number'].includes(normalizedType)) {
    return [...baseOperators, ...textOperators];
  }
  return [...baseOperators, { value: 'contains', label: 'Contains' }, { value: 'not_contains', label: 'Does Not Contain' }];
}

export function isOptionBasedFieldType(fieldType?: string | null): boolean {
  const t = (fieldType || '').toLowerCase().replace(/[_\s]/g, '-');
  return [
    'select',
    'multi-select',
    'multiselect',
    'radio',
    'checkbox',
    'toggle',
    'toggle-switch',
    'dropdown',
  ].includes(t);
}

export function normalizeConditionOperator(raw: unknown): ComparisonOperator {
  const value = String(raw ?? '==').trim();
  const aliases: Record<string, ComparisonOperator> = {
    equals: '==',
    equal: '==',
    is: '==',
    not_equals: '!=',
    not_equal: '!=',
    startsWith: 'starts_with',
    endsWith: 'ends_with',
    isEmpty: 'not_exists',
    isNotEmpty: 'exists',
    empty: 'not_exists',
    not_empty: 'exists',
  };
  return (aliases[value] || value) as ComparisonOperator;
}
