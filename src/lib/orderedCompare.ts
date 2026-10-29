const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type OrderedOperator = '<' | '>' | '<=' | '>=';

/**
 * Ordered comparison used by form rules.
 * ISO dates (YYYY-MM-DD) compare as dates. Every other pair keeps numeric comparison.
 */
export function compareOrdered(
  currentValue: unknown,
  conditionValue: unknown,
  operator: OrderedOperator,
): boolean {
  const left = typeof currentValue === 'string' ? currentValue.trim() : '';
  const right = typeof conditionValue === 'string' ? conditionValue.trim() : '';
  if (ISO_DATE.test(left) && ISO_DATE.test(right)) {
    switch (operator) {
      case '<': return left < right;
      case '>': return left > right;
      case '<=': return left <= right;
      case '>=': return left >= right;
    }
  }

  const a = Number(currentValue);
  const b = Number(conditionValue);
  switch (operator) {
    case '<': return a < b;
    case '>': return a > b;
    case '<=': return a <= b;
    case '>=': return a >= b;
  }
}

export function resolveConditionCompareValue(
  condition: { value?: unknown; compareToField?: string },
  formData: Record<string, unknown>,
): unknown {
  if (condition.compareToField) {
    const other = formData[condition.compareToField];
    return other === undefined || other === null ? '' : other;
  }
  return condition.value;
}
