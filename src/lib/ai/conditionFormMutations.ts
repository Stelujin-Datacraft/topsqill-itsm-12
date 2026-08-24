import { backend as supabase } from '@/services/api';
import { sanitizeAiFieldType } from '@/lib/createFormFromAiGeneration';
import { isOptionBasedFieldType } from '@/utils/conditionOperators';
import type { ConditionFormFieldMeta } from '@/lib/ai/resolveWorkflowConditions';

function parsePages(rawPages: unknown, fallbackFieldIds: string[] = []): Array<{
  id: string;
  name: string;
  order: number;
  fields: string[];
}> {
  try {
    const raw = typeof rawPages === 'string' ? JSON.parse(rawPages) : rawPages;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((p: any, idx: number) => ({
        id: p.id || `page-${idx + 1}`,
        name: p.name || `Page ${idx + 1}`,
        order: typeof p.order === 'number' ? p.order : idx,
        fields: Array.isArray(p.fields) ? [...p.fields] : [],
      }));
    }
  } catch {
    /* ignore */
  }
  return [{
    id: 'default',
    name: 'Page 1',
    order: 0,
    fields: [...fallbackFieldIds],
  }];
}

function parseOptions(raw: unknown): Array<{ id?: string; value: string; label: string }> {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((o: any, idx: number) => ({
      id: o.id || `opt-${idx}`,
      value: String(o.value ?? o.label ?? ''),
      label: String(o.label ?? o.value ?? ''),
    }));
  } catch {
    return [];
  }
}

function optionKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function labelKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface CreatedConditionField {
  id: string;
  label: string;
  type: string;
  options: Array<{ id?: string; value: string; label: string }>;
  custom_config?: Record<string, unknown> | null;
}

/** Create a form field (user-confirmed) and attach it to the first form page. Prevents duplicates by label. */
export async function createConditionFormField(params: {
  formId: string;
  label: string;
  type?: string;
  initialValue?: unknown;
  customConfig?: Record<string, unknown> | null;
}): Promise<CreatedConditionField> {
  const label = params.label.trim();
  if (!label) throw new Error('Field label is required');
  if (!params.formId) throw new Error('Form id is required');

  const fieldType = sanitizeAiFieldType(params.type || 'text');

  const { data: existingRows, error: existingError } = await supabase
    .from('form_fields')
    .select('id, label, field_type, options, custom_config')
    .eq('form_id', params.formId);

  if (existingError) throw new Error(existingError.message || 'Failed to load form fields');

  const duplicate = (existingRows || []).find((row: any) => labelKey(row.label) === labelKey(label));
  if (duplicate) {
    let custom_config: Record<string, unknown> | null = null;
    if (duplicate.custom_config) {
      try {
        custom_config = typeof duplicate.custom_config === 'string'
          ? JSON.parse(duplicate.custom_config)
          : duplicate.custom_config;
      } catch {
        custom_config = null;
      }
    }
    return {
      id: duplicate.id,
      label: duplicate.label,
      type: duplicate.field_type,
      options: parseOptions(duplicate.options),
      custom_config,
    };
  }

  let options: Array<{ id: string; value: string; label: string }> | null = null;
  if (isOptionBasedFieldType(fieldType) && params.initialValue != null && String(params.initialValue).trim()) {
    const valueLabel = String(params.initialValue).trim();
    options = [{
      id: `opt_${Date.now()}`,
      value: valueLabel,
      label: valueLabel,
    }];
  } else if (isOptionBasedFieldType(fieldType)) {
    options = [];
  }

  const { data: orderRows } = await supabase
    .from('form_fields')
    .select('field_order')
    .eq('form_id', params.formId)
    .order('field_order', { ascending: false })
    .limit(1);

  const maxOrder = orderRows && orderRows.length > 0
    ? (orderRows[0].field_order || 0) + 1
    : 0;

  const customConfig = params.customConfig && Object.keys(params.customConfig).length
    ? params.customConfig
    : null;

  const { data: inserted, error: insertError } = await supabase
    .from('form_fields')
    .insert({
      form_id: params.formId,
      field_type: fieldType,
      label,
      placeholder: '',
      required: false,
      default_value: '',
      options: options ? JSON.stringify(options) : null,
      validation: null,
      permissions: JSON.stringify({ read: ['*'], write: ['*'] }),
      triggers: JSON.stringify([]),
      is_visible: true,
      is_enabled: true,
      current_value: '',
      tooltip: '',
      error_message: '',
      field_order: maxOrder,
      custom_config: customConfig ? JSON.stringify(customConfig) : null,
    } as any)
    .select('id, label, field_type, options, custom_config')
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message || 'Failed to create field');
  }

  // Attach to form pages metadata
  const { data: formRow, error: formError } = await supabase
    .from('forms')
    .select('id, pages')
    .eq('id', params.formId)
    .single();

  if (formError) {
    console.error('createConditionFormField: could not load form pages', formError);
  } else if (formRow) {
    const existingIds = (existingRows || []).map((r: any) => r.id as string);
    const pages = parsePages(formRow.pages, existingIds);
    const target = pages.sort((a, b) => a.order - b.order)[0] || pages[0];
    if (target && !target.fields.includes(inserted.id)) {
      target.fields = [...target.fields, inserted.id];
      const { error: pagesError } = await supabase
        .from('forms')
        .update({ pages: JSON.stringify(pages) })
        .eq('id', params.formId);
      if (pagesError) {
        console.error('createConditionFormField: failed to update pages', pagesError);
      }
    }
  }

  let insertedConfig: Record<string, unknown> | null = customConfig;
  if (inserted.custom_config && !insertedConfig) {
    try {
      insertedConfig = typeof inserted.custom_config === 'string'
        ? JSON.parse(inserted.custom_config)
        : inserted.custom_config;
    } catch {
      insertedConfig = null;
    }
  }

  return {
    id: inserted.id,
    label: inserted.label,
    type: inserted.field_type,
    options: parseOptions(inserted.options),
    custom_config: insertedConfig,
  };
}

/**
 * Ensure Submission Access Control allowedUsers includes the given user ids
 * so change_field_value validation accepts them at runtime.
 */
export async function mergeSubmissionAccessAllowedUsers(params: {
  fieldId: string;
  userIds: string[];
}): Promise<Record<string, unknown>> {
  const userIds = [...new Set((params.userIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!params.fieldId) throw new Error('Field id is required');

  const { data: field, error } = await supabase
    .from('form_fields')
    .select('id, custom_config')
    .eq('id', params.fieldId)
    .single();

  if (error || !field) throw new Error(error?.message || 'Field not found');

  let config: Record<string, any> = {};
  if (field.custom_config) {
    try {
      config = typeof field.custom_config === 'string'
        ? JSON.parse(field.custom_config)
        : { ...field.custom_config };
    } catch {
      config = {};
    }
  }

  const existingUsers = Array.isArray(config.allowedUsers) ? config.allowedUsers.map(String) : [];
  const existingGroups = Array.isArray(config.allowedGroups) ? config.allowedGroups.map(String) : [];
  const mergedUsers = [...new Set([...existingUsers, ...userIds])];

  const nextConfig = {
    ...config,
    allowedUsers: mergedUsers,
    allowedGroups: existingGroups,
    accessLevel: config.accessLevel || 'edit',
    allowMultiple: config.allowMultiple !== false,
  };

  const { error: updateError } = await supabase
    .from('form_fields')
    .update({ custom_config: JSON.stringify(nextConfig) })
    .eq('id', params.fieldId);

  if (updateError) throw new Error(updateError.message || 'Failed to update Submission Access Control');

  return nextConfig;
}

/** Append an option to a dropdown/radio/checkbox/toggle field. Prevents duplicates. */
export async function addConditionFieldOption(params: {
  fieldId: string;
  valueLabel: string;
}): Promise<{ value: string; label: string; options: Array<{ id?: string; value: string; label: string }> }> {
  const valueLabel = params.valueLabel.trim();
  if (!valueLabel) throw new Error('Value is required');
  if (!params.fieldId) throw new Error('Field id is required');

  const { data: field, error } = await supabase
    .from('form_fields')
    .select('id, options')
    .eq('id', params.fieldId)
    .single();

  if (error || !field) throw new Error(error?.message || 'Field not found');

  const options = parseOptions(field.options);
  const existing = options.find((o) =>
    optionKey(o.value) === optionKey(valueLabel)
    || optionKey(o.label) === optionKey(valueLabel),
  );
  if (existing) {
    return { value: existing.value, label: existing.label, options };
  }

  const next = [
    ...options,
    {
      id: `opt_${Date.now()}`,
      value: valueLabel,
      label: valueLabel,
    },
  ];

  const { error: updateError } = await supabase
    .from('form_fields')
    .update({ options: JSON.stringify(next) })
    .eq('id', params.fieldId);

  if (updateError) throw new Error(updateError.message || 'Failed to create value');

  return { value: valueLabel, label: valueLabel, options: next };
}

/** Build resolver field map from copilot / designer form metadata. */
export function buildConditionFieldsByFormId(
  forms: Array<{
    id: string;
    fields?: Array<{
      id: string;
      label: string;
      type: string;
      options?: Array<{ id?: string; value: string; label: string }>;
    }>;
  }>,
): Record<string, ConditionFormFieldMeta[]> {
  const map: Record<string, ConditionFormFieldMeta[]> = {};
  forms.forEach((form) => {
    map[form.id] = (form.fields || []).map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      options: Array.isArray(f.options) ? f.options : [],
    }));
  });
  return map;
}
