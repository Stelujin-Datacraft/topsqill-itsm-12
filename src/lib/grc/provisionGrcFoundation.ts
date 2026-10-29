import {
  ensureRegulatoryFormFillAccess,
  newRegulatoryId,
  regulatoryFormPermissionsJson,
} from '@/lib/regulatory/regulatoryFormAccess';
import {
  GRC_CROSS_LINKS,
  GRC_FOUNDATION_FORMS,
  type FoundationCrossLink,
} from '@/lib/grc/foundationCatalog';
import { createFoundationBlueprint } from '@/lib/grc/createFoundationBlueprint';

type DbError = { message?: string } | null;
type DbClient = { from: (table: string) => any };

export interface ProvisionFoundationInput {
  organizationId: string;
  projectId: string;
  createdBy: string;
}

export interface ProvisionFoundationResult {
  createdReferenceIds: string[];
  forms: Array<{ id: string; reference_id?: string; name?: string } & Record<string, unknown>>;
}

/**
 * Creates the four foundation forms when they are missing.
 * Does not edit Regulatory Standard Library, Clause Register, or Requirement Register fields.
 * Does not insert child cross-reference fields.
 */
export async function provisionGrcFoundationIfMissing(
  client: DbClient,
  input: ProvisionFoundationInput,
): Promise<ProvisionFoundationResult> {
  const createdReferenceIds: string[] = [];
  const forms: ProvisionFoundationResult['forms'] = [];

  for (const spec of GRC_FOUNDATION_FORMS) {
    let form = await findForm(client, input.projectId, spec.referenceId);
    if (form) {
      await ensureRegulatoryFormFillAccess(client, form.id, form.permissions);
    } else {
      form = await insertForm(client, input, spec);
      createdReferenceIds.push(spec.referenceId);
    }
    forms.push(form);
  }

  const formsByReference = new Map<string, { id: string } & Record<string, unknown>>();
  for (const form of forms) {
    if (form.reference_id) formsByReference.set(String(form.reference_id), form);
  }
  const requirement = await findForm(client, input.projectId, 'grc.requirement-register');
  if (requirement) formsByReference.set('grc.requirement-register', requirement);

  for (const link of GRC_CROSS_LINKS) {
    const source = formsByReference.get(link.sourceReferenceId);
    const target = formsByReference.get(link.targetReferenceId);
    if (!source || !target) continue;
    const displayColumns = await displayColumnIds(client, target.id, link.displayKeys);
    if (displayColumns.length !== link.displayKeys.length) continue;
    await repairCrossReference(client, source.id, link, {
      targetFormId: target.id,
      targetFormName: link.targetFormName,
      displayColumns,
    });
  }

  return { createdReferenceIds, forms };
}

async function findForm(client: DbClient, projectId: string, referenceId: string) {
  const { data, error } = await client
    .from('forms')
    .select('*')
    .eq('project_id', projectId)
    .eq('reference_id', referenceId)
    .limit(1);
  if (error) throw new Error(error.message || `Failed to look up ${referenceId}`);
  const row = Array.isArray(data) ? data[0] : data;
  return (row || null) as ({ id: string; reference_id?: string; permissions?: unknown } & Record<string, unknown>) | null;
}

async function fieldsForForm(client: DbClient, formId: string) {
  const { data, error } = await client.from('form_fields').select('*').eq('form_id', formId);
  if (error) throw new Error(error.message || 'Failed to load form fields');
  return (data || []) as Array<Record<string, any>>;
}

async function displayColumnIds(client: DbClient, formId: string, keys: readonly string[]) {
  const fields = await fieldsForForm(client, formId);
  return keys.flatMap((key) => {
    const match = fields.find((field) => parseConfig(field.custom_config).libraryKey === key);
    return match?.id ? [String(match.id)] : [];
  });
}

async function insertForm(
  client: DbClient,
  input: ProvisionFoundationInput,
  spec: (typeof GRC_FOUNDATION_FORMS)[number],
) {
  const blueprint = createFoundationBlueprint(spec, () => newRegulatoryId());
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
    form_rules: JSON.stringify([]),
    layout: JSON.stringify(blueprint.layout),
    pages: JSON.stringify(blueprint.pages),
  };
  const { data: formRow, error: formError } = await client.from('forms').insert(formInsert).select().single();
  if (formError || !formRow) throw new Error(formError?.message || `Failed to create ${blueprint.name}`);

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
    is_enabled: field.isEnabled !== false,
    current_value: '',
    tooltip: field.tooltip || '',
    error_message: '',
    field_order: index,
    custom_config: JSON.stringify(field.customConfig || {}),
  }));
  const { error: fieldError } = await client.from('form_fields').insert(fieldRows) as { error: DbError };
  if (fieldError) {
    await client.from('forms').delete().eq('id', formRow.id);
    throw new Error(fieldError.message || `Failed to create ${blueprint.name} fields`);
  }
  return formRow as { id: string; reference_id?: string } & Record<string, unknown>;
}

async function repairCrossReference(
  client: DbClient,
  formId: string,
  link: FoundationCrossLink,
  target: { targetFormId: string; targetFormName: string; displayColumns: string[] },
) {
  const fields = await fieldsForForm(client, formId);
  const field = fields.find((row) => parseConfig(row.custom_config).libraryKey === link.libraryKey);
  if (!field) return;
  const config = parseConfig(field.custom_config);
  if (
    config.targetFormId === target.targetFormId
    && Array.isArray(config.displayColumns)
    && config.displayColumns.length === target.displayColumns.length
  ) {
    return;
  }
  const { error } = await client.from('form_fields').update({
    custom_config: JSON.stringify({
      ...config,
      libraryKey: link.libraryKey,
      targetFormId: target.targetFormId,
      targetFormName: target.targetFormName,
      displayColumns: target.displayColumns,
      tableDisplayFields: target.displayColumns,
      hyperlinkField: target.displayColumns[0],
      enableSorting: true,
      enableSearch: true,
      pageSize: 10,
    }),
  }).eq('id', field.id);
  if (error) throw new Error(error.message || 'Failed to configure cross-reference');
}

function parseConfig(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, any>;
  return {};
}
