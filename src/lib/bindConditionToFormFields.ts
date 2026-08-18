import {
  normalizeConditionOperator,
  normalizeRelativeDateCondition,
  coerceOperatorForFieldType,
  isOptionBasedFieldType,
} from '@/utils/conditionOperators';
import type { ComparisonOperator } from '@/types/conditions';

export interface ConditionBindFieldMeta {
  id: string;
  label: string;
  type: string;
  options?: Array<{ id?: string; value: string; label: string }>;
}

function labelKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Find a form field by UUID id or by label / slug-like id from AI. */
export function findConditionFieldMatch(
  fields: ConditionBindFieldMeta[],
  fieldId?: string,
  fieldLabel?: string,
): ConditionBindFieldMeta | undefined {
  if (!fields.length) return undefined;

  if (fieldId) {
    const byId = fields.find((f) => f.id === fieldId);
    if (byId) return byId;
  }

  const candidates = [fieldLabel, fieldId].filter(Boolean).map((s) => labelKey(String(s)));
  for (const target of candidates) {
    if (!target) continue;
    const exact = fields.find((f) => labelKey(f.label) === target);
    if (exact) return exact;
  }
  for (const target of candidates) {
    if (!target) continue;
    const partial = fields.find((f) => {
      const n = labelKey(f.label);
      return n.includes(target) || target.includes(n);
    });
    if (partial) return partial;
  }
  return undefined;
}

/** Map AI option label/value to the field's real option.value for Select binding. */
export function findConditionOptionValue(
  field: ConditionBindFieldMeta | undefined,
  requested: unknown,
): string {
  if (requested === undefined || requested === null) return '';
  const raw = String(requested).trim();
  if (!raw) return '';
  if (!field || !isOptionBasedFieldType(field.type)) return raw;

  const options = Array.isArray(field.options) ? field.options : [];
  if (options.length === 0) return raw;

  const lower = raw.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]+/g, '');
  const synonyms: Record<string, string[]> = {
    male: ['m', 'man', 'boy'],
    female: ['f', 'woman', 'girl'],
    married: ['marriage', 'wed'],
    single: ['unmarried'],
    yes: ['y', 'true', 'on'],
    no: ['n', 'false', 'off'],
    approved: ['approve', 'accepted', 'accept', 'completed', 'complete', 'passed', 'pass', 'success', 'ok', 'done'],
    rejected: ['reject', 'denied', 'deny', 'failed', 'fail', 'cancelled', 'canceled', 'declined', 'archived'],
    pending: ['inprogress', 'in progress', 'draft', 'submitted', 'waiting', 'open'],
    completed: ['complete', 'approved', 'approve', 'done', 'success'],
  };
  const queries = new Set<string>([lower, compact]);
  for (const [canonical, alts] of Object.entries(synonyms)) {
    if (
      lower === canonical
      || alts.includes(lower)
      || alts.includes(compact)
      || compact === canonical.replace(/[^a-z0-9]+/g, '')
    ) {
      queries.add(canonical);
      alts.forEach((a) => queries.add(a));
    }
  }

  for (const q of queries) {
    const match = options.find((o) =>
      String(o.value).toLowerCase() === q
      || String(o.label).toLowerCase() === q
      || String(o.id || '').toLowerCase() === q
      || String(o.value).toLowerCase().replace(/[^a-z0-9]+/g, '') === q
      || String(o.label).toLowerCase().replace(/[^a-z0-9]+/g, '') === q,
    );
    if (match) return String(match.value);
  }

  const partials = options.filter((o) => {
    const v = String(o.value).toLowerCase();
    const l = String(o.label).toLowerCase();
    return [...queries].some((q) => q.length >= 2 && (v.includes(q) || l.includes(q)));
  });
  if (partials.length === 1) return String(partials[0].value);
  return raw;
}

/**
 * Bind an AI/stored field-level condition to live form field metadata so
 * Field/Operator/Value Selects have exact matching values.
 */
export function bindConditionToFormFields(
  condition: {
    formId?: string;
    fieldId?: string;
    fieldLabel?: string;
    fieldType?: string;
    operator?: string;
    value?: unknown;
  },
  fields: ConditionBindFieldMeta[],
  preferredFormId?: string,
): {
  formId: string;
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  operator: ComparisonOperator;
  value: string;
  matched: boolean;
} {
  const formId = preferredFormId || condition.formId || '';
  const matched = findConditionFieldMatch(
    fields,
    condition.fieldId,
    condition.fieldLabel || condition.fieldId,
  );

  if (!matched) {
    const operator = coerceOperatorForFieldType(
      condition.fieldType || 'text',
      normalizeConditionOperator(condition.operator || '=='),
    );
    const dateNorm = normalizeRelativeDateCondition(
      condition.fieldType || 'text',
      operator,
      condition.value,
    );
    return {
      formId,
      fieldId: condition.fieldId || '',
      fieldLabel: condition.fieldLabel || '',
      fieldType: condition.fieldType || 'text',
      operator: dateNorm.operator,
      value: String(dateNorm.value ?? ''),
      matched: false,
    };
  }

  let operator = coerceOperatorForFieldType(
    matched.type,
    normalizeConditionOperator(condition.operator || '=='),
  );
  const dateNorm = normalizeRelativeDateCondition(matched.type, operator, condition.value);
  operator = dateNorm.operator;

  const value = isOptionBasedFieldType(matched.type)
    ? findConditionOptionValue(matched, dateNorm.value)
    : String(dateNorm.value ?? '');

  return {
    formId,
    fieldId: matched.id,
    fieldLabel: matched.label,
    fieldType: matched.type,
    operator,
    value,
    matched: true,
  };
}
