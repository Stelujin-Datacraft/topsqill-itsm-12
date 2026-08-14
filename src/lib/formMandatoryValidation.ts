import type { FormField, FormPage } from '@/types/form';

export interface MandatoryFieldIssue {
  fieldId: string;
  fieldName: string;
  pageId: string;
  pageName: string;
  sectionName: string;
  /** Display as "Field Name — Page/Section Name" */
  locationLabel: string;
}

export function isFieldValueEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'boolean' || typeof value === 'number') return false;
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length === 0;
  }
  return false;
}

export function resolveFieldLocation(
  field: FormField,
  pages: FormPage[],
  allFields: FormField[],
): { pageId: string; pageName: string; sectionName: string; locationLabel: string } {
  const page =
    pages.find((p) => Array.isArray(p.fields) && p.fields.includes(field.id))
    || pages.find((p) => p.id === field.pageId)
    || pages[0];

  const pageName = page?.name || 'Form';
  let sectionName = pageName;

  if (page?.fields?.length) {
    const fieldIndex = page.fields.indexOf(field.id);
    if (fieldIndex > 0) {
      for (let i = fieldIndex - 1; i >= 0; i--) {
        const prev = allFields.find((f) => f.id === page.fields[i]);
        if (prev && (prev.type === 'section-break' || prev.type === 'header')) {
          sectionName = (prev.label || '').trim() || pageName;
          break;
        }
      }
    }
  }

  return {
    pageId: page?.id || 'default',
    pageName,
    sectionName,
    locationLabel: sectionName,
  };
}

export function collectMandatoryFieldIssues(params: {
  fields: FormField[];
  pages: FormPage[];
  formData: Record<string, any>;
  fieldStates?: Record<string, {
    isVisible?: boolean;
    isEnabled?: boolean;
    isRequired?: boolean;
    label?: string;
  }>;
}): MandatoryFieldIssue[] {
  const { fields, pages, formData, fieldStates = {} } = params;
  const issues: MandatoryFieldIssue[] = [];

  for (const field of fields) {
    // Skip layout-only fields
    if (['header', 'description', 'section-break', 'horizontal-line', 'full-width-container', 'rich-text'].includes(field.type)) {
      continue;
    }

    const state = fieldStates[field.id];
    const isVisible = state?.isVisible ?? field.isVisible ?? true;
    const isEnabled = state?.isEnabled ?? field.isEnabled ?? true;
    if (!isVisible || !isEnabled) continue;

    const isRequired = Boolean(field.required || state?.isRequired);
    if (!isRequired) continue;

    if (isFieldValueEmpty(formData[field.id])) {
      const location = resolveFieldLocation(field, pages, fields);
      const fieldName = state?.label || field.label || 'Untitled field';
      issues.push({
        fieldId: field.id,
        fieldName,
        pageId: location.pageId,
        pageName: location.pageName,
        sectionName: location.sectionName,
        locationLabel: location.locationLabel,
      });
    }
  }

  return issues;
}

const OPTION_FIELD_TYPES = new Set(['select', 'multi-select', 'radio', 'checkbox']);

export function isOptionBasedFieldType(type?: string | null): boolean {
  return OPTION_FIELD_TYPES.has((type || '').toLowerCase());
}

export function getValidDropdownOptions(options: unknown): Array<{ id?: string; value: string; label: string; color?: string; image?: string }> {
  let parsed: unknown = options;
  if (typeof options === 'string') {
    try {
      parsed = JSON.parse(options);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((opt, index) => {
      if (typeof opt === 'string') {
        const value = opt.trim();
        return value ? { id: `opt-${index}`, value, label: value } : null;
      }
      if (opt && typeof opt === 'object') {
        const value = String((opt as any).value ?? (opt as any).label ?? '').trim();
        const label = String((opt as any).label ?? (opt as any).value ?? '').trim();
        if (!value && !label) return null;
        return {
          id: (opt as any).id || `opt-${index}`,
          value: value || label,
          label: label || value,
          color: (opt as any).color,
          image: (opt as any).image,
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{ id?: string; value: string; label: string; color?: string; image?: string }>;
}

/** Returns an error message if dropdown options are invalid; otherwise null. */
export function validateDropdownOptionsConfig(
  fieldType: string | undefined,
  options: unknown,
  required?: boolean,
): string | null {
  if (!isOptionBasedFieldType(fieldType)) return null;

  const valid = getValidDropdownOptions(options);
  if (valid.length === 0) {
    return 'Dropdown fields must have at least one option with a value and label.';
  }

  if (required) {
    const hasBlank = (Array.isArray(options) ? options : []).some((opt: any) => {
      if (typeof opt === 'string') return opt.trim() === '';
      if (opt && typeof opt === 'object') {
        return String(opt.value ?? '').trim() === '' && String(opt.label ?? '').trim() === '';
      }
      return false;
    });
    if (hasBlank) {
      return 'Mandatory dropdowns cannot include blank options. Remove empty options or fill them in.';
    }
  }

  return null;
}

export function buildDefaultDropdownOptions(count = 1): Array<{ id: string; value: string; label: string; color: string }> {
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];
  return Array.from({ length: Math.max(1, count) }, (_, i) => ({
    id: `option-${Date.now()}-${i}`,
    value: `option_${i + 1}`,
    label: `Option ${i + 1}`,
    color: colors[i % colors.length],
  }));
}
