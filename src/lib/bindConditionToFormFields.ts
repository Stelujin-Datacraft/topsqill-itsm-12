import {
  normalizeConditionOperator,
  normalizeRelativeDateCondition,
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
  const match = options.find((o) =>
    String(o.value).toLowerCase() === lower
    || String(o.label).toLowerCase() === lower
    || String(o.id || '').toLowerCase() === lower,
  );
  return match ? String(match.value) : raw;
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
    const operator = normalizeConditionOperator(condition.operator || '==');
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

  let operator = normalizeConditionOperator(condition.operator || '==');
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
