import {
  ensureRegulatoryFormFillAccess,
  newRegulatoryId,
  regulatoryFormPermissionsJson,
} from '@/lib/regulatory/regulatoryFormAccess';
import {
  STANDARD_LIBRARY_REFERENCE_ID,
  createStandardLibraryBlueprint,
  libraryKeyForField,
} from '@/lib/regulatory/standardLibraryForm';

type DbError = { message?: string } | null;

export interface ProvisionStandardLibraryInput {
  organizationId: string;
  projectId: string;
  createdBy: string;
  alreadyPresent?: boolean;
}

export interface ProvisionStandardLibraryResult {
  created: boolean;
  form: Record<string, unknown> | null;
}

/**
 * Inserts Regulatory Standard Library once per project.
 * Does not overwrite an existing form with the same reference id.
 * Does not create Regulatory Clause Register or sample records.
 */
export async function provisionStandardLibraryIfMissing(
  client: { from: (table: string) => any },
  input: ProvisionStandardLibraryInput,
): Promise<ProvisionStandardLibraryResult> {
  if (input.alreadyPresent) {
    await ensureCountryDropdown(client, input);
    await ensureExistingFillAccess(client, input);
    return { created: false, form: null };
  }

  const { data: existing, error: existingError } = await client
    .from('forms')
    .select('id, permissions')
    .eq('organization_id', input.organizationId)
    .eq('project_id', input.projectId)
    .eq('reference_id', STANDARD_LIBRARY_REFERENCE_ID);

  if (existingError) {
    throw new Error(existingError.message || 'Failed to look up Regulatory Standard Library');
  }
  if (Array.isArray(existing) && existing.length > 0) {
    await ensureCountryDropdown(client, input);
    await ensureRegulatoryFormFillAccess(client, existing[0].id, existing[0].permissions);
    return { created: false, form: null };
  }

  const blueprint = createStandardLibraryBlueprint(() => newRegulatoryId());

  const formInsert = {
    name: blueprint.name,
    description: blueprint.description,
    organization_id: input.organizationId,
    project_id: input.projectId,
    status: 'active',
    created_by: input.createdBy,
    is_public: false,
    reference_id: blueprint.referenceId,
    permissions: regulatoryFormPermissionsJson(),
    share_settings: JSON.stringify({ allowPublicAccess: false, sharedUsers: [] }),
    field_rules: JSON.stringify([]),
    form_rules: JSON.stringify(blueprint.formRules),
    layout: JSON.stringify(blueprint.layout),
    pages: JSON.stringify(blueprint.pages),
  };

  const { data: formRow, error: formError } = await client
    .from('forms')
    .insert(formInsert)
    .select()
    .single();

  if (formError || !formRow) {
    throw new Error(formError?.message || 'Failed to create Regulatory Standard Library');
  }

  const fieldRows = blueprint.fields.map((field, index) => ({
    id: field.id,
    form_id: formRow.id,
    field_type: field.type,
    label: field.label,
    placeholder: field.placeholder || '',
    required: Boolean(field.required),
    default_value: field.defaultValue ?? null,
    options: field.options ? JSON.stringify(field.options) : null,
    validation: field.validation ? JSON.stringify(field.validation) : null,
    permissions: JSON.stringify(field.permissions || { read: ['*'], write: ['*'] }),
    triggers: JSON.stringify([]),
    is_visible: true,
    is_enabled: true,
    current_value: '',
    tooltip: '',
    error_message: '',
    field_order: index,
    custom_config: JSON.stringify({
      ...(field.customConfig || {}),
      libraryKey: libraryKeyForField(field),
    }),
  }));

  const { error: fieldError } = await client.from('form_fields').insert(fieldRows) as { error: DbError };
  if (fieldError) {
    await client.from('forms').delete().eq('id', formRow.id);
    throw new Error(fieldError.message || 'Failed to create Regulatory Standard Library fields');
  }

  return { created: true, form: formRow };
}

async function ensureExistingFillAccess(
  client: { from: (table: string) => any },
  input: ProvisionStandardLibraryInput,
): Promise<void> {
  const { data, error } = await client
    .from('forms')
    .select('id, permissions')
    .eq('organization_id', input.organizationId)
    .eq('project_id', input.projectId)
    .eq('reference_id', STANDARD_LIBRARY_REFERENCE_ID);
  if (error) {
    throw new Error(error.message || 'Failed to look up Regulatory Standard Library');
  }
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.id) return;
  await ensureRegulatoryFormFillAccess(client, row.id, row.permissions);
}

/** Point an already created Country / Region field at the country dropdown. */
async function ensureCountryDropdown(
  client: { from: (table: string) => any },
  input: ProvisionStandardLibraryInput,
): Promise<void> {
  const { data: forms, error } = await client
    .from('forms')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('project_id', input.projectId)
    .eq('reference_id', STANDARD_LIBRARY_REFERENCE_ID);

  if (error) {
    throw new Error(error.message || 'Failed to look up Regulatory Standard Library');
  }
  const formId = Array.isArray(forms) ? forms[0]?.id : undefined;
  if (!formId) return;

  const { data: fields, error: fieldsError } = await client
    .from('form_fields')
    .select('id, field_type, label, custom_config')
    .eq('form_id', formId);

  if (fieldsError) {
    throw new Error(fieldsError.message || 'Failed to load Regulatory Standard Library fields');
  }

  const field = (fields || []).find((row: { label?: string; custom_config?: unknown }) => {
    const config = parseConfig(row.custom_config);
    return config.libraryKey === 'country_region' || row.label === 'Country / Region';
  });
  if (!field || field.field_type === 'country') return;

  const config = parseConfig(field.custom_config);
  const { error: updateError } = await client
    .from('form_fields')
    .update({
      field_type: 'country',
      placeholder: 'Select a country',
      custom_config: JSON.stringify({
        ...config,
        libraryKey: 'country_region',
        searchable: true,
        showFlags: true,
      }),
    })
    .eq('id', field.id);

  if (updateError) {
    throw new Error(updateError.message || 'Failed to set Country / Region to the country dropdown');
  }
}

function parseConfig(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}
