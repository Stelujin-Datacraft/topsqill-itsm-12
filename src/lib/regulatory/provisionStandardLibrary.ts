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
  if (input.alreadyPresent) return { created: false, form: null };

  const { data: existing, error: existingError } = await client
    .from('forms')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('project_id', input.projectId)
    .eq('reference_id', STANDARD_LIBRARY_REFERENCE_ID);

  if (existingError) {
    throw new Error(existingError.message || 'Failed to look up Regulatory Standard Library');
  }
  if (Array.isArray(existing) && existing.length > 0) {
    return { created: false, form: null };
  }

  const blueprint = createStandardLibraryBlueprint(() => crypto.randomUUID());

  const formInsert = {
    name: blueprint.name,
    description: blueprint.description,
    organization_id: input.organizationId,
    project_id: input.projectId,
    status: 'active',
    created_by: input.createdBy,
    is_public: false,
    reference_id: blueprint.referenceId,
    permissions: JSON.stringify({ view: [], submit: [], edit: [] }),
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
