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

export function isDateLikeFieldType(fieldType?: string | null): boolean {
  const t = (fieldType || '').toLowerCase().replace(/[_\s]/g, '-');
  return ['date', 'datetime', 'date-time', 'datetime-local'].includes(t);
}

/** Relative date operators that do not take a concrete date value. */
export function isNoValueConditionOperator(operator?: string | null): boolean {
  return [
    'exists', 'not_exists',
    'is_today', 'is_yesterday', 'is_tomorrow',
    'is_current_week', 'is_last_week', 'is_next_week',
    'is_current_month', 'is_last_month', 'is_next_month',
    'is_current_year', 'is_last_year',
  ].includes(String(operator || ''));
}

export function normalizeConditionOperator(raw: unknown): ComparisonOperator {
  const value = String(raw ?? '==').trim();
  const normalized = value.toLowerCase().replace(/[\s-]+/g, '_');
  const aliases: Record<string, ComparisonOperator> = {
    equals: '==',
    equal: '==',
    eq: '==',
    is: '==',
    not_equals: '!=',
    not_equal: '!=',
    ne: '!=',
    '!==': '!=',
    greater_than: '>',
    // Common AI typo from "greate than"
    greate_than: '>',
    gt: '>',
    less_than: '<',
    lt: '<',
    greater_than_or_equal: '>=',
    greater_or_equal: '>=',
    gte: '>=',
    less_than_or_equal: '<=',
    less_or_equal: '<=',
    lte: '<=',
    after: 'after',
    before: 'before',
    on_or_after: 'on_or_after',
    on_or_before: 'on_or_before',
    startsWith: 'starts_with',
    starts_with: 'starts_with',
    endsWith: 'ends_with',
    ends_with: 'ends_with',
    isEmpty: 'not_exists',
    isNotEmpty: 'exists',
    empty: 'not_exists',
    not_empty: 'exists',
    is_today: 'is_today',
    today: 'is_today',
    is_yesterday: 'is_yesterday',
    yesterday: 'is_yesterday',
    is_tomorrow: 'is_tomorrow',
    tomorrow: 'is_tomorrow',
    is_current_week: 'is_current_week',
    current_week: 'is_current_week',
    this_week: 'is_current_week',
    is_last_week: 'is_last_week',
    last_week: 'is_last_week',
    is_next_week: 'is_next_week',
    next_week: 'is_next_week',
    is_current_month: 'is_current_month',
    current_month: 'is_current_month',
    this_month: 'is_current_month',
    is_last_month: 'is_last_month',
    last_month: 'is_last_month',
    is_next_month: 'is_next_month',
    next_month: 'is_next_month',
    is_current_year: 'is_current_year',
    current_year: 'is_current_year',
    this_year: 'is_current_year',
    is_last_year: 'is_last_year',
    last_year: 'is_last_year',
  };
  return (aliases[normalized] || aliases[value] || value) as ComparisonOperator;
}

/**
 * Date/datetime fields use after/before — not numeric >/<.
 * Map AI "greater than" / ">" onto After so the Operator Select stays selected.
 */
export function coerceOperatorForFieldType(
  fieldType: string | undefined,
  operator: ComparisonOperator,
): ComparisonOperator {
  const op = normalizeConditionOperator(operator);
  if (!isDateLikeFieldType(fieldType)) return op;

  const dateNumericMap: Record<string, ComparisonOperator> = {
    '>': 'after',
    '>=': 'on_or_after',
    '<': 'before',
    '<=': 'on_or_before',
  };
  return dateNumericMap[op] || op;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function expandShortYear(year: number): number {
  if (year >= 1000) return year;
  // 0–29 → 2000–2029, 30–99 → 1930–1999 (common DOB heuristic)
  if (year < 0) return year;
  if (year <= 29) return 2000 + year;
  if (year < 100) return 1900 + year;
  // 3-digit years like 206 → 2006
  if (year < 1000) return 2000 + (year % 100);
  return year;
}

/**
 * Normalize AI/user date strings to YYYY-MM-DD for <input type="date">.
 * Handles ISO, DD/MM/YYYY, MM/DD/YYYY (when unambiguous), and short years (e.g. 01/10/206 → 2006-10-01).
 */
export function normalizeConditionDateValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  // Already ISO date or datetime
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Slash or dash separated: D/M/Y or M/D/Y
  const parts = raw.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/);
  if (!parts) return raw;

  let a = Number(parts[1]);
  let b = Number(parts[2]);
  let c = Number(parts[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return raw;

  let year: number;
  let month: number;
  let day: number;

  // If first segment looks like a year (4 digits or 3-digit short year alone as last)
  if (parts[1].length === 4) {
    year = a;
    month = b;
    day = c;
  } else if (parts[3].length >= 3 || parts[3].length === 2 || parts[3].length === 1) {
    // D/M/Y or M/D/Y with year last
    year = expandShortYear(c);
    // Prefer DMY when day > 12; prefer MDY when first > 12; else assume DMY (common outside US)
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else {
      // Ambiguous — prefer DMY for AI prompts like 01/10/206
      day = a;
      month = b;
    }
  } else {
    return raw;
  }

  year = expandShortYear(year);
  if (month < 1 || month > 12 || day < 1 || day > 31) return raw;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Map AI/natural-language date conditions onto operators the Condition Builder understands.
 * e.g. Equals + "today" → is_today (no value), so the date picker is not left blank.
 */
export function normalizeRelativeDateCondition(
  fieldType: string | undefined,
  operator: ComparisonOperator,
  value: unknown,
): { operator: ComparisonOperator; value: unknown } {
  if (!isDateLikeFieldType(fieldType)) {
    return { operator: normalizeConditionOperator(operator), value };
  }

  let nextOperator = coerceOperatorForFieldType(fieldType, operator);
  const raw = String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');

  // Operator itself may already be a relative keyword from the AI
  if (isNoValueConditionOperator(nextOperator)) {
    return { operator: nextOperator, value: '' };
  }

  const relativeValueToOperator: Array<{ test: RegExp; operator: ComparisonOperator }> = [
    { test: /^(today|todays date|today'?s date|current date|now)$/, operator: 'is_today' },
    { test: /^(yesterday)$/, operator: 'is_yesterday' },
    { test: /^(tomorrow)$/, operator: 'is_tomorrow' },
    { test: /^(this week|current week)$/, operator: 'is_current_week' },
    { test: /^(last week)$/, operator: 'is_last_week' },
    { test: /^(next week)$/, operator: 'is_next_week' },
    { test: /^(this month|current month)$/, operator: 'is_current_month' },
    { test: /^(last month)$/, operator: 'is_last_month' },
    { test: /^(next month)$/, operator: 'is_next_month' },
    { test: /^(this year|current year)$/, operator: 'is_current_year' },
    { test: /^(last year)$/, operator: 'is_last_year' },
  ];

  for (const entry of relativeValueToOperator) {
    if (!entry.test.test(raw)) continue;

    // Equals / is → dedicated relative operator (no date input needed)
    if (nextOperator === '==') {
      return { operator: entry.operator, value: '' };
    }

    // Not equals today → concrete ISO date so the date picker still works
    if (nextOperator === '!=') {
      if (entry.operator === 'is_today') return { operator: '!=', value: todayIsoDate() };
      if (entry.operator === 'is_yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return { operator: '!=', value: d.toISOString().slice(0, 10) };
      }
      if (entry.operator === 'is_tomorrow') {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return { operator: '!=', value: d.toISOString().slice(0, 10) };
      }
    }

    // after/before/on_or_* "today" → keep operator, use concrete ISO date
    if (['after', 'before', 'on_or_after', 'on_or_before'].includes(nextOperator)) {
      if (entry.operator === 'is_today') return { operator: nextOperator, value: todayIsoDate() };
      if (entry.operator === 'is_yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return { operator: nextOperator, value: d.toISOString().slice(0, 10) };
      }
      if (entry.operator === 'is_tomorrow') {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return { operator: nextOperator, value: d.toISOString().slice(0, 10) };
      }
    }
  }

  // Natural language future/past phrases commonly emitted by AI
  if (/^(in the )?future$|^upcoming$|^later than today$/.test(raw)) {
    return { operator: 'after', value: todayIsoDate() };
  }
  if (/^(in the )?past$|^earlier than today$|^before today$/.test(raw)) {
    return { operator: 'before', value: todayIsoDate() };
  }

  // last/next N days as value text
  const lastN = raw.match(/^last\s+(\d+)\s+days?$/);
  if (lastN) return { operator: 'last_n_days', value: lastN[1] };
  const nextN = raw.match(/^next\s+(\d+)\s+days?$/);
  if (nextN) return { operator: 'next_n_days', value: nextN[1] };

  // Year-only (“after 2006”) → concrete ISO for the date picker
  const yearOnly = String(value ?? '').trim().match(/^(19|20)\d{2}$/);
  if (yearOnly) {
    const year = yearOnly[0];
    if (nextOperator === 'after') return { operator: nextOperator, value: `${year}-12-31` };
    if (nextOperator === 'before') return { operator: nextOperator, value: `${year}-01-01` };
    if (nextOperator === 'on_or_after') return { operator: nextOperator, value: `${year}-01-01` };
    if (nextOperator === 'on_or_before') return { operator: nextOperator, value: `${year}-12-31` };
    return { operator: nextOperator, value: `${year}-01-01` };
  }

  // Concrete calendar dates → ISO so the date picker shows the value
  const isoValue = normalizeConditionDateValue(value);
  return { operator: nextOperator, value: isoValue };
}
