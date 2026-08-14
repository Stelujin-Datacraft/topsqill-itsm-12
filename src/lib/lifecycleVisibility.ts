import type { FormField } from '@/types/form';
import { isSystemStatusField } from '@/lib/systemStatusField';

/**
 * Lifecycle/Status bars should be visible as soon as the record form opens.
 * System Status fields and fields marked showWithoutCondition are always shown.
 * Fields with no visibility condition default to visible (not hidden).
 */
export function isLifecycleFieldVisible(
  field: FormField,
  formData: Record<string, any> = {},
): boolean {
  if (field.type !== 'select') return false;
  const cfg = (field.customConfig || {}) as Record<string, any>;
  if (!cfg.displayAsLifecycle && !isSystemStatusField(field)) return false;

  if (isSystemStatusField(field) || cfg.showWithoutCondition) return true;

  const condition = cfg.lifecycleVisibilityCondition;
  if (!condition || !condition.fieldId) {
    // No condition configured → visible by default (do not hide until saved)
    return true;
  }

  const fieldValue = formData[condition.fieldId];
  const conditionValue = condition.value;

  switch (condition.operator) {
    case '==':
      return String(fieldValue || '') === String(conditionValue || '');
    case '!=':
      return String(fieldValue || '') !== String(conditionValue || '');
    case 'contains':
      return String(fieldValue || '').toLowerCase().includes(String(conditionValue || '').toLowerCase());
    case 'not_empty':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    case 'empty':
      return fieldValue === undefined || fieldValue === null || fieldValue === '';
    default:
      return true;
  }
}

export function getLifecycleFields(
  fields: FormField[] | undefined,
  formData: Record<string, any> = {},
): FormField[] {
  if (!fields?.length) return [];
  return fields.filter((field) => {
    const cfg = (field.customConfig || {}) as Record<string, any>;
    const isLifecycle =
      field.type === 'select'
      && (cfg.displayAsLifecycle === true || isSystemStatusField(field));
    if (!isLifecycle) return false;
    return isLifecycleFieldVisible(field, formData);
  });
}
