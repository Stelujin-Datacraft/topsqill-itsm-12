import type { FormField, FormPage } from '@/types/form';
import type { FoundationFormSpec } from '@/lib/grc/foundationCatalog';

export function pageIdForName(name: string): string {
  return `page-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export function optionList(labels: readonly string[]) {
  return labels.map((label) => ({
    id: `opt-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    value: label,
    label,
  }));
}

export function createFoundationBlueprint(
  spec: FoundationFormSpec,
  idForKey: (key: string) => string = (key) => key,
) {
  const idByKey = new Map(spec.fields.map((field) => [field.key, idForKey(field.key)]));
  const fields: FormField[] = spec.fields.map((field) => ({
    id: idByKey.get(field.key)!,
    type: field.type,
    label: field.label,
    placeholder: field.placeholder || '',
    required: field.required,
    defaultValue: field.defaultValue,
    options: field.options ? optionList(field.options) : undefined,
    validation: field.validation,
    permissions: { read: ['*'], write: ['*'] },
    triggers: [],
    isVisible: true,
    isEnabled: field.enabled !== false,
    tooltip: field.tooltip || '',
    pageId: pageIdForName(field.page),
    customConfig: { libraryKey: field.key },
  }));

  const pages: FormPage[] = spec.pages.map((name, order) => ({
    id: pageIdForName(name),
    name,
    order,
    fields: spec.fields.filter((field) => field.page === name).map((field) => idByKey.get(field.key)!),
  }));

  return {
    name: spec.name,
    description: spec.description,
    referenceId: spec.referenceId,
    layout: { columns: 2 as const },
    pages,
    fields,
    formRules: [] as [],
  };
}
