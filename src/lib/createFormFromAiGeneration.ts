import { backend as supabase } from '@/services/api';
import { ensureSystemStatusField } from '@/lib/systemStatusField';

export interface AiGeneratedFormField {
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  tooltip?: string;
  options?: Array<{ label: string; value: string }>;
  validation?: Record<string, unknown>;
  defaultValue?: string | boolean | string[] | number | null;
  isFullWidth?: boolean;
  customConfig?: Record<string, unknown>;
}

export interface AiGeneratedFormSchema {
  name: string;
  description: string;
  fields: AiGeneratedFormField[];
  pages?: Array<{ name: string; description?: string; fieldIndexes: number[] }>;
  suggestedLayout?: 1 | 2 | 3;
}

export interface CreateFormFromAiContext {
  projectId: string;
  organizationId: string;
  userId: string;
}

const VALID_FIELD_TYPES = new Set([
  'header', 'description', 'section-break', 'horizontal-line', 'full-width-container',
  'rich-text', 'record-table', 'matrix-grid',
  'text', 'textarea', 'number', 'date', 'time', 'datetime',
  'select', 'multi-select', 'radio', 'checkbox', 'toggle-switch',
  'slider', 'rating', 'file', 'image', 'color',
  'country', 'address', 'currency', 'email', 'url',
  'ip-address', 'barcode', 'user-picker', 'group-picker',
  'approval', 'signature', 'tags', 'dynamic-dropdown',
  'cross-reference', 'child-cross-reference', 'calculated', 'conditional-section',
  'geo-location', 'workflow-trigger', 'submission-access', 'query-field',
]);

const FIELD_TYPE_ALIASES: Record<string, string> = {
  'checkbox-group': 'checkbox',
  toggle: 'toggle-switch',
  divider: 'horizontal-line',
  heading: 'header',
  'rich-text-editor': 'rich-text',
  multiselect: 'multi-select',
  switch: 'toggle-switch',
  separator: 'horizontal-line',
  title: 'header',
  'text-area': 'textarea',
  dropdown: 'select',
  phone: 'text',
  telephone: 'text',
  tel: 'text',
  'phone-number': 'text',
  mobile: 'text',
};

export function sanitizeAiFieldType(type: string): string {
  const normalized = (type || 'text').toLowerCase().trim();
  if (VALID_FIELD_TYPES.has(normalized)) return normalized;
  return FIELD_TYPE_ALIASES[normalized] || 'text';
}

function serializeDefaultValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function buildFieldCustomConfig(field: AiGeneratedFormField): Record<string, unknown> | null {
  const merged: Record<string, unknown> = {
    ...(field.customConfig && typeof field.customConfig === 'object' ? field.customConfig : {}),
  };
  if (typeof field.isFullWidth === 'boolean') {
    merged.isFullWidth = field.isFullWidth;
  } else if (
    ['textarea', 'address', 'header', 'description', 'section-break', 'horizontal-line', 'rich-text'].includes(
      sanitizeAiFieldType(field.type),
    )
  ) {
    merged.isFullWidth = true;
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

/**
 * Creates a form using the same steps as Forms → "Generate with AI".
 * Uses the frontend API client (RLS-aware) instead of the copilot edge action.
 */
export async function createFormFromAiGeneration(
  generatedForm: AiGeneratedFormSchema,
  context: CreateFormFromAiContext,
): Promise<{ formId: string; formName: string; fieldCount: number; pageCount: number }> {
  const { projectId, organizationId, userId } = context;

  if (!Array.isArray(generatedForm.fields) || generatedForm.fields.length === 0) {
    throw new Error('AI did not return any form fields. Try describing the fields you need.');
  }

  const aiPages = generatedForm.pages && generatedForm.pages.length > 0
    ? generatedForm.pages
    : null;

  const referencedIndexes = new Set<number>();
  if (aiPages) {
    aiPages.forEach((p) => {
      (p.fieldIndexes || []).forEach((idx) => {
        if (typeof idx === 'number' && idx >= 0 && idx < generatedForm.fields.length) {
          referencedIndexes.add(idx);
        }
      });
    });
    // If pages were returned without indexes, put all fields on the first page.
    if (referencedIndexes.size === 0) {
      generatedForm.fields.forEach((_, idx) => referencedIndexes.add(idx));
    }
  }

  const formPages = aiPages
    ? aiPages.map((p, idx) => ({
        id: `page-${idx + 1}`,
        name: p.name || `Page ${idx + 1}`,
        order: idx,
        fields: [] as string[],
      }))
    : [{ id: 'default', name: 'Page 1', order: 0, fields: [] as string[] }];

  const fieldPageMap: Record<number, string> = {};
  if (aiPages) {
    aiPages.forEach((page, pageIdx) => {
      (page.fieldIndexes || []).forEach((fieldIdx) => {
        fieldPageMap[fieldIdx] = `page-${pageIdx + 1}`;
      });
    });
    if (Object.keys(fieldPageMap).length === 0) {
      generatedForm.fields.forEach((_, idx) => {
        fieldPageMap[idx] = formPages[0].id;
      });
    }
  }

  const { data: newFormRow, error: formError } = await supabase
    .from('forms')
    .insert({
      name: generatedForm.name,
      description: generatedForm.description,
      organization_id: organizationId,
      project_id: projectId,
      status: 'draft',
      permissions: JSON.stringify({ view: [], submit: [], edit: [] }),
      created_by: userId,
      is_public: false,
      share_settings: JSON.stringify({ allowPublicAccess: false, sharedUsers: [] }),
      field_rules: JSON.stringify([]),
      form_rules: JSON.stringify([]),
      layout: JSON.stringify({ columns: generatedForm.suggestedLayout || 1 }),
      pages: JSON.stringify(formPages),
    })
    .select()
    .single();

  if (formError || !newFormRow) {
    throw new Error(formError?.message || 'Failed to create form');
  }

  const pageFieldIds: Record<string, string[]> = {};
  formPages.forEach((p) => { pageFieldIds[p.id] = []; });

  let fieldCount = 0;

  for (let i = 0; i < generatedForm.fields.length; i++) {
    if (aiPages && !referencedIndexes.has(i)) continue;

    const field = generatedForm.fields[i];
    // System Status field is added via ensureSystemStatusField — skip AI duplicates
    if ((field.label || '').trim().toLowerCase() === 'status'
      && sanitizeAiFieldType(field.type) === 'select') {
      continue;
    }

    const pageId = fieldPageMap[i] || formPages[0]?.id || 'default';
    const mappedOptions = field.options?.map((opt, idx) => ({
      id: `opt-${idx}-${Date.now()}`,
      value: opt.value,
      label: opt.label,
    }));

    const sanitizedType = sanitizeAiFieldType(field.type);
    const customConfig = buildFieldCustomConfig(field);

    const { data: existingFields } = await supabase
      .from('form_fields')
      .select('field_order')
      .eq('form_id', newFormRow.id)
      .order('field_order', { ascending: false })
      .limit(1);

    const maxOrder = existingFields && existingFields.length > 0
      ? (existingFields[0].field_order || 0) + 1
      : 0;

    const { data: newFieldRow, error: fieldError } = await supabase
      .from('form_fields')
      .insert({
        form_id: newFormRow.id,
        field_type: sanitizedType,
        label: field.label,
        placeholder: field.placeholder || '',
        required: field.required || false,
        default_value: serializeDefaultValue(field.defaultValue),
        options: mappedOptions ? JSON.stringify(mappedOptions) : null,
        validation: field.validation ? JSON.stringify(field.validation) : null,
        permissions: JSON.stringify({ read: ['*'], write: ['*'] }),
        triggers: JSON.stringify([]),
        is_visible: true,
        is_enabled: true,
        current_value: '',
        tooltip: field.tooltip || '',
        error_message: '',
        field_order: maxOrder,
        custom_config: customConfig ? JSON.stringify(customConfig) : null,
      })
      .select('id')
      .single();

    if (fieldError || !newFieldRow) {
      throw new Error(fieldError?.message || `Failed to create field "${field.label}"`);
    }

    if (pageFieldIds[pageId]) {
      pageFieldIds[pageId].push(newFieldRow.id);
    }
    fieldCount += 1;
  }

  const updatedPages = formPages.map((p) => ({
    ...p,
    fields: pageFieldIds[p.id] || [],
  }));

  const { error: pagesError } = await supabase
    .from('forms')
    .update({ pages: JSON.stringify(updatedPages) })
    .eq('id', newFormRow.id);

  if (pagesError) {
    throw new Error(pagesError.message || 'Failed to assign fields to pages');
  }

  // Always ensure the system Status lifecycle field exists
  await ensureSystemStatusField(supabase, newFormRow.id);

  const { data: finalFields } = await supabase
    .from('form_fields')
    .select('id')
    .eq('form_id', newFormRow.id);
  const { data: finalForm } = await supabase
    .from('forms')
    .select('pages')
    .eq('id', newFormRow.id)
    .single();

  let pageCount = formPages.length;
  try {
    const rawPages = typeof finalForm?.pages === 'string' ? JSON.parse(finalForm.pages) : finalForm?.pages;
    if (Array.isArray(rawPages) && rawPages.length > 0) pageCount = rawPages.length;
  } catch {
    /* ignore */
  }

  return {
    formId: newFormRow.id,
    formName: newFormRow.name,
    fieldCount: finalFields?.length ?? fieldCount,
    pageCount,
  };
}
