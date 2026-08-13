import { backend as supabase } from '@/services/api';
import {
  sanitizeAiFieldType,
  type AiGeneratedFormField,
  type AiGeneratedFormSchema,
} from '@/lib/createFormFromAiGeneration';

export interface UpdateFormFromAiResult {
  formId: string;
  formName: string;
  addedFieldCount: number;
  skippedExistingCount: number;
  totalFieldCount: number;
}

/**
 * Append AI-generated fields onto an existing form (does not create a new form).
 * Skips fields whose labels already exist on the form.
 */
export async function updateFormFromAiGeneration(
  formId: string,
  generated: Pick<AiGeneratedFormSchema, 'fields'> & { name?: string; description?: string },
  options?: { replaceName?: boolean; replaceDescription?: boolean },
): Promise<UpdateFormFromAiResult> {
  if (!Array.isArray(generated.fields) || generated.fields.length === 0) {
    throw new Error('AI did not return any fields to add. Describe the fields you want to change.');
  }

  const { data: formRow, error: formError } = await supabase
    .from('forms')
    .select('id, name, description, pages')
    .eq('id', formId)
    .single();

  if (formError || !formRow) {
    throw new Error(formError?.message || 'Form not found');
  }

  const { data: existingFieldRows, error: fieldsError } = await supabase
    .from('form_fields')
    .select('id, label, field_order')
    .eq('form_id', formId)
    .order('field_order', { ascending: true });

  if (fieldsError) {
    throw new Error(fieldsError.message || 'Failed to load existing fields');
  }

  const existingFields = existingFieldRows || [];
  const existingLabels = new Set(
    existingFields.map((f) => (f.label || '').trim().toLowerCase()).filter(Boolean),
  );

  const toAdd: AiGeneratedFormField[] = [];
  let skippedExistingCount = 0;
  for (const field of generated.fields) {
    const labelKey = (field.label || '').trim().toLowerCase();
    if (!labelKey) continue;
    if (existingLabels.has(labelKey)) {
      skippedExistingCount += 1;
      continue;
    }
    existingLabels.add(labelKey);
    toAdd.push(field);
  }

  if (toAdd.length === 0) {
    throw new Error(
      'Those fields already exist on this form. Try describing different fields, or ask to create a new form.',
    );
  }

  let pages: Array<{ id: string; name: string; order: number; fields: string[] }> = [];
  try {
    const raw = typeof formRow.pages === 'string' ? JSON.parse(formRow.pages) : formRow.pages;
    if (Array.isArray(raw) && raw.length > 0) {
      pages = raw.map((p: any, idx: number) => ({
        id: p.id || `page-${idx + 1}`,
        name: p.name || `Page ${idx + 1}`,
        order: typeof p.order === 'number' ? p.order : idx,
        fields: Array.isArray(p.fields) ? [...p.fields] : [],
      }));
    }
  } catch {
    pages = [];
  }

  if (pages.length === 0) {
    pages = [{
      id: 'default',
      name: 'Page 1',
      order: 0,
      fields: existingFields.map((f) => f.id),
    }];
  }

  const targetPage = pages[0];
  let nextOrder = existingFields.reduce((max, f) => Math.max(max, f.field_order ?? 0), -1) + 1;
  let addedFieldCount = 0;

  for (const field of toAdd) {
    const mappedOptions = field.options?.map((opt, idx) => ({
      id: `opt-${idx}-${Date.now()}-${addedFieldCount}`,
      value: opt.value,
      label: opt.label,
    }));

    const { data: newFieldRow, error: fieldError } = await supabase
      .from('form_fields')
      .insert({
        form_id: formId,
        field_type: sanitizeAiFieldType(field.type),
        label: field.label,
        placeholder: field.placeholder || '',
        required: field.required || false,
        default_value: '',
        options: mappedOptions ? JSON.stringify(mappedOptions) : null,
        validation: field.validation ? JSON.stringify(field.validation) : null,
        permissions: JSON.stringify({ read: ['*'], write: ['*'] }),
        triggers: JSON.stringify([]),
        is_visible: true,
        is_enabled: true,
        current_value: '',
        tooltip: field.tooltip || '',
        error_message: '',
        field_order: nextOrder,
        custom_config: null,
      })
      .select('id')
      .single();

    if (fieldError || !newFieldRow) {
      throw new Error(fieldError?.message || `Failed to add field "${field.label}"`);
    }

    targetPage.fields.push(newFieldRow.id);
    nextOrder += 1;
    addedFieldCount += 1;
  }

  const formUpdates: Record<string, unknown> = {
    pages: JSON.stringify(pages),
  };
  if (options?.replaceName && generated.name) formUpdates.name = generated.name;
  if (options?.replaceDescription && generated.description != null) {
    formUpdates.description = generated.description;
  }

  const { error: pagesError } = await supabase
    .from('forms')
    .update(formUpdates)
    .eq('id', formId);

  if (pagesError) {
    throw new Error(pagesError.message || 'Failed to update form pages');
  }

  return {
    formId,
    formName: (formUpdates.name as string) || formRow.name,
    addedFieldCount,
    skippedExistingCount,
    totalFieldCount: existingFields.length + addedFieldCount,
  };
}
