import type { FormField, FormPage } from '@/types/form';

export const SYSTEM_STATUS_FIELD_LABEL = 'Status';

/** Default lifecycle dropdown values for the system Status field. */
export const SYSTEM_STATUS_OPTIONS: Array<{ id: string; value: string; label: string }> = [
  { id: 'status-opt-draft', value: 'Draft', label: 'Draft' },
  { id: 'status-opt-inprogress', value: 'Inprogress', label: 'Inprogress' },
  { id: 'status-opt-pending', value: 'Pending', label: 'Pending' },
  { id: 'status-opt-completed', value: 'Completed', label: 'Completed' },
  { id: 'status-opt-archived', value: 'Archived', label: 'Archived' },
];

export const SYSTEM_STATUS_CUSTOM_CONFIG = {
  isSystemField: true,
  displayAsLifecycle: true,
  showWithoutCondition: true,
  requireCommentOnChange: false,
  searchable: false,
  clearable: false,
} as const;

export function isSystemStatusField(field?: {
  label?: string | null;
  type?: string | null;
  field_type?: string | null;
  customConfig?: Record<string, unknown> | null;
  custom_config?: unknown;
} | null): boolean {
  if (!field) return false;
  const config = parseConfig(field.customConfig ?? field.custom_config);
  return Boolean(config?.isSystemField);
}

function parseConfig(raw: unknown): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, any>;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw as Record<string, any>;
  return null;
}

function parsePages(raw: unknown, fallbackFieldIds: string[] = []): FormPage[] {
  try {
    const pages = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(pages) && pages.length > 0) {
      return pages.map((p: any, idx: number) => ({
        id: p.id || (idx === 0 ? 'default' : `page-${idx + 1}`),
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

function mapDbFieldToFormField(row: any, pageId: string): FormField {
  const customConfig = parseConfig(row.custom_config) || {};
  let options = row.options;
  if (typeof options === 'string') {
    try { options = JSON.parse(options); } catch { options = []; }
  }
  return {
    id: row.id,
    type: (row.field_type || 'select') as FormField['type'],
    label: row.label,
    placeholder: row.placeholder || '',
    required: Boolean(row.required),
    defaultValue: row.default_value || 'Draft',
    options: Array.isArray(options) ? options : SYSTEM_STATUS_OPTIONS,
    validation: {},
    permissions: { read: ['*'], write: ['*'] },
    triggers: [],
    isVisible: row.is_visible !== false,
    isEnabled: row.is_enabled !== false,
    currentValue: '',
    tooltip: row.tooltip || '',
    errorMessage: row.error_message || '',
    pageId,
    customConfig: {
      ...SYSTEM_STATUS_CUSTOM_CONFIG,
      ...customConfig,
      isSystemField: true,
      displayAsLifecycle: true,
      showWithoutCondition: true,
    },
  };
}

export function buildSystemStatusFieldInsert(formId: string, fieldOrder = 0) {
  return {
    form_id: formId,
    field_type: 'select',
    label: SYSTEM_STATUS_FIELD_LABEL,
    placeholder: 'Select status',
    required: true,
    default_value: 'Draft',
    options: JSON.stringify(SYSTEM_STATUS_OPTIONS),
    validation: null,
    permissions: JSON.stringify({ read: ['*'], write: ['*'] }),
    triggers: JSON.stringify([]),
    is_visible: true,
    is_enabled: true,
    current_value: '',
    tooltip: 'Record lifecycle status',
    error_message: '',
    field_order: fieldOrder,
    custom_config: JSON.stringify({ ...SYSTEM_STATUS_CUSTOM_CONFIG }),
  };
}

/**
 * Ensures every form has the system Status select field (lifecycle-enabled, always visible).
 * Idempotent: upgrades an existing Status select or skips if already present.
 */
export async function ensureSystemStatusField(
  supabase: { from: (table: string) => any },
  formId: string,
): Promise<{ field: FormField; pages: FormPage[]; created: boolean }> {
  const { data: formRow, error: formError } = await supabase
    .from('forms')
    .select('id, pages')
    .eq('id', formId)
    .single();

  if (formError || !formRow) {
    throw new Error(formError?.message || 'Form not found while ensuring Status field');
  }

  const { data: existingFields, error: fieldsError } = await supabase
    .from('form_fields')
    .select('id, label, field_type, field_order, placeholder, required, default_value, options, validation, tooltip, error_message, is_visible, is_enabled, custom_config')
    .eq('form_id', formId)
    .order('field_order', { ascending: true });

  if (fieldsError) {
    throw new Error(fieldsError.message || 'Failed to load fields while ensuring Status field');
  }

  const fields = existingFields || [];
  const pages = parsePages(formRow.pages, fields.map((f: any) => f.id));
  const firstPage = [...pages].sort((a, b) => a.order - b.order)[0] || pages[0];

  const systemExisting = fields.find((f: any) => isSystemStatusField(f));
  if (systemExisting) {
    // Keep page membership correct
    if (firstPage && !firstPage.fields.includes(systemExisting.id)) {
      firstPage.fields = [systemExisting.id, ...firstPage.fields.filter((id) => id !== systemExisting.id)];
      await supabase.from('forms').update({ pages: JSON.stringify(pages) }).eq('id', formId);
    }
    return {
      field: mapDbFieldToFormField(systemExisting, firstPage?.id || 'default'),
      pages,
      created: false,
    };
  }

  const statusCandidate = fields.find((f: any) =>
    (f.label || '').trim().toLowerCase() === 'status'
    && (f.field_type || '').toLowerCase() === 'select',
  );

  if (statusCandidate) {
    const mergedConfig = {
      ...SYSTEM_STATUS_CUSTOM_CONFIG,
      ...(parseConfig(statusCandidate.custom_config) || {}),
      isSystemField: true,
      displayAsLifecycle: true,
      showWithoutCondition: true,
    };
    const { error: upgradeError } = await supabase
      .from('form_fields')
      .update({
        required: true,
        default_value: statusCandidate.default_value || 'Draft',
        options: statusCandidate.options || JSON.stringify(SYSTEM_STATUS_OPTIONS),
        custom_config: JSON.stringify(mergedConfig),
        label: SYSTEM_STATUS_FIELD_LABEL,
      })
      .eq('id', statusCandidate.id);

    if (upgradeError) {
      throw new Error(upgradeError.message || 'Failed to upgrade Status field');
    }

    if (firstPage && !firstPage.fields.includes(statusCandidate.id)) {
      firstPage.fields = [statusCandidate.id, ...firstPage.fields.filter((id) => id !== statusCandidate.id)];
      await supabase.from('forms').update({ pages: JSON.stringify(pages) }).eq('id', formId);
    }

    return {
      field: mapDbFieldToFormField({
        ...statusCandidate,
        required: true,
        custom_config: mergedConfig,
        options: statusCandidate.options || SYSTEM_STATUS_OPTIONS,
        default_value: statusCandidate.default_value || 'Draft',
      }, firstPage?.id || 'default'),
      pages,
      created: false,
    };
  }

  const nextOrder = fields.reduce((max: number, f: any) => Math.max(max, f.field_order ?? 0), -1) + 1;
  // Prefer order 0 so Status appears first; shift isn't required for correctness
  const insertPayload = buildSystemStatusFieldInsert(formId, fields.length === 0 ? 0 : nextOrder);

  const { data: inserted, error: insertError } = await supabase
    .from('form_fields')
    .insert(insertPayload)
    .select('id, label, field_type, field_order, placeholder, required, default_value, options, validation, tooltip, error_message, is_visible, is_enabled, custom_config')
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message || 'Failed to create system Status field');
  }

  if (firstPage) {
    firstPage.fields = [inserted.id, ...firstPage.fields.filter((id) => id !== inserted.id)];
  }

  const { error: pagesError } = await supabase
    .from('forms')
    .update({ pages: JSON.stringify(pages) })
    .eq('id', formId);

  if (pagesError) {
    throw new Error(pagesError.message || 'Failed to attach Status field to form page');
  }

  return {
    field: mapDbFieldToFormField(inserted, firstPage?.id || 'default'),
    pages,
    created: true,
  };
}
