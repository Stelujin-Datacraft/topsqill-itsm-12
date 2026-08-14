import type { SupabaseClient } from '@supabase/supabase-js';

const VALID_FIELD_TYPES = new Set([
  'text', 'textarea', 'number', 'email', 'phone', 'date', 'time', 'datetime',
  'select', 'multi-select', 'radio', 'checkbox', 'toggle-switch', 'file', 'image',
  'signature', 'rating', 'slider', 'header', 'description', 'horizontal-line',
  'section-break', 'tags', 'country', 'address', 'currency', 'url', 'color',
  'rich-text', 'cross-reference', 'calculated', 'query-field',
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
};

export function getActionErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error';
}

function sanitizeFieldType(type: string): string {
  const normalized = (type || 'text').toLowerCase().trim();
  if (VALID_FIELD_TYPES.has(normalized)) return normalized;
  return FIELD_TYPE_ALIASES[normalized] || 'text';
}

const SYSTEM_STATUS_OPTIONS = [
  { id: 'status-opt-draft', value: 'Draft', label: 'Draft' },
  { id: 'status-opt-inprogress', value: 'Inprogress', label: 'Inprogress' },
  { id: 'status-opt-pending', value: 'Pending', label: 'Pending' },
  { id: 'status-opt-completed', value: 'Completed', label: 'Completed' },
  { id: 'status-opt-archived', value: 'Archived', label: 'Archived' },
];

const SYSTEM_STATUS_CUSTOM_CONFIG = {
  isSystemField: true,
  displayAsLifecycle: true,
  showWithoutCondition: true,
  requireCommentOnChange: false,
  searchable: false,
  clearable: false,
};

function buildSystemStatusFieldRow(formId: string, fieldOrder = 0) {
  return {
    form_id: formId,
    field_type: 'select',
    label: 'Status',
    placeholder: 'Select status',
    required: true,
    default_value: 'Draft',
    options: JSON.stringify(SYSTEM_STATUS_OPTIONS),
    field_order: fieldOrder,
    tooltip: 'Record lifecycle status',
    custom_config: JSON.stringify(SYSTEM_STATUS_CUSTOM_CONFIG),
    permissions: JSON.stringify({ read: ['*'], write: ['*'] }),
    triggers: JSON.stringify([]),
    is_visible: true,
    is_enabled: true,
    current_value: '',
    error_message: '',
  };
}

/**
 * Inserts AI-generated form fields and wires them into forms.pages[].fields
 * (the Form Builder reads field membership from pages, not a page_id column).
 * Always prepends the system Status lifecycle field.
 */
export async function insertAiGeneratedFormFields(
  supabase: SupabaseClient,
  formId: string,
  rawFields: unknown,
  rawPages?: unknown,
): Promise<{ fieldCount: number; pageCount: number }> {
  let fields = rawFields;
  if (typeof fields === 'string') {
    try { fields = JSON.parse(fields); } catch { fields = []; }
  }
  if (!Array.isArray(fields)) fields = [];

  let pages = rawPages;
  if (typeof pages === 'string') {
    try { pages = JSON.parse(pages); } catch { pages = null; }
  }
  const aiPages = Array.isArray(pages) && pages.length > 0 ? pages as Array<{ name?: string; fieldIndexes?: number[] }> : null;

  const formPages = aiPages
    ? aiPages.map((p, idx) => ({
        id: `page-${idx + 1}`,
        name: p.name || `Page ${idx + 1}`,
        order: idx,
        fields: [] as string[],
      }))
    : [{ id: 'default', name: 'Page 1', order: 0, fields: [] as string[] }];

  const fieldPageMap: Record<number, string> = {};
  const referencedIndexes = new Set<number>();

  if (aiPages) {
    aiPages.forEach((page, pageIdx) => {
      (page.fieldIndexes || []).forEach((fieldIdx) => {
        if (typeof fieldIdx === 'number' && fieldIdx >= 0 && fieldIdx < fields.length) {
          referencedIndexes.add(fieldIdx);
          fieldPageMap[fieldIdx] = `page-${pageIdx + 1}`;
        }
      });
    });
    if (referencedIndexes.size === 0 && fields.length > 0) {
      fields.forEach((_: unknown, idx: number) => {
        referencedIndexes.add(idx);
        fieldPageMap[idx] = formPages[0].id;
      });
    }
  }

  const pageFieldIds: Record<string, string[]> = {};
  formPages.forEach((p) => { pageFieldIds[p.id] = []; });

  const fieldsToInsert: Array<Record<string, unknown>> = [
    buildSystemStatusFieldRow(formId, 0),
  ];
  const fieldMeta: Array<{ pageId: string; order: number }> = [
    { pageId: formPages[0]?.id || 'default', order: 0 },
  ];

  for (let i = 0; i < fields.length; i++) {
    if (aiPages && !referencedIndexes.has(i)) continue;
    const f = fields[i] as Record<string, unknown>;
    if (!f?.label) continue;
    // Skip AI Status select — system Status is already prepended
    if (String(f.label).trim().toLowerCase() === 'status'
      && sanitizeFieldType(String(f.type || 'text')) === 'select') {
      continue;
    }

    const pageId = fieldPageMap[i] || formPages[0]?.id || 'default';
    let options = f.options;
    if (options && typeof options === 'object') {
      options = JSON.stringify(options);
    }

    fieldsToInsert.push({
      form_id: formId,
      field_type: sanitizeFieldType(String(f.type || 'text')),
      label: f.label,
      placeholder: f.placeholder || null,
      required: Boolean(f.required),
      field_order: fieldsToInsert.length,
      options: options || null,
      tooltip: f.tooltip || null,
      custom_config: f.customConfig || f.custom_config
        ? JSON.stringify(f.customConfig || f.custom_config)
        : null,
    });
    fieldMeta.push({ pageId, order: fieldsToInsert.length - 1 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('form_fields')
    .insert(fieldsToInsert)
    .select('id');

  if (insertError) {
    throw new Error(`Failed to create form fields: ${insertError.message}`);
  }

  (inserted || []).forEach((row, idx) => {
    const meta = fieldMeta[idx];
    if (row?.id && meta && pageFieldIds[meta.pageId]) {
      pageFieldIds[meta.pageId].push(row.id);
    }
  });

  const updatedPages = formPages.map((p) => ({
    ...p,
    fields: pageFieldIds[p.id] || [],
  }));

  const { error: updateError } = await supabase
    .from('forms')
    .update({ pages: updatedPages })
    .eq('id', formId);

  if (updateError) {
    throw new Error(`Failed to assign fields to pages: ${updateError.message}`);
  }

  return { fieldCount: inserted?.length || 0, pageCount: formPages.length };
}
