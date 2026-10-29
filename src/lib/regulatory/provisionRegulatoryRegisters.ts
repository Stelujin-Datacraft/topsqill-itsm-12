import {
  ensureRegulatoryFormFillAccess,
  regulatoryFormPermissionsJson,
} from '@/lib/regulatory/regulatoryFormAccess';
import { STANDARD_LIBRARY_FORM_NAME, STANDARD_LIBRARY_REFERENCE_ID } from '@/lib/regulatory/standardLibraryForm';
import {
  CLAUSE_REGISTER_FORM_NAME,
  CLAUSE_REGISTER_REFERENCE_ID,
  CLAUSE_STANDARD_DISPLAY_KEYS,
  createClauseRegisterBlueprint,
} from '@/lib/regulatory/clauseRegisterForm';
import {
  REQUIREMENT_CLAUSE_DISPLAY_KEYS,
  REQUIREMENT_REGISTER_REFERENCE_ID,
  createRequirementRegisterBlueprint,
} from '@/lib/regulatory/requirementRegisterForm';

type DbError = { message?: string } | null;

export interface ProvisionRegistersInput {
  organizationId: string;
  projectId: string;
  createdBy: string;
}

export interface ProvisionRegistersResult {
  clauseCreated: boolean;
  requirementCreated: boolean;
  clauseForm: Record<string, unknown> | null;
  requirementForm: Record<string, unknown> | null;
  /** Set when Regulatory Standard Library is missing. No register form is created in that case. */
  blockedReason: string | null;
}

/**
 * Creates Regulatory Clause Register, then Regulatory Requirement Register.
 * Does not create or edit Regulatory Standard Library.
 * Does not insert a child cross-reference onto the standard form.
 */
export async function provisionRegulatoryRegistersIfMissing(
  client: { from: (table: string) => any },
  input: ProvisionRegistersInput,
): Promise<ProvisionRegistersResult> {
  const result: ProvisionRegistersResult = {
    clauseCreated: false,
    requirementCreated: false,
    clauseForm: null,
    requirementForm: null,
    blockedReason: null,
  };

  const standard = await findForm(client, input, STANDARD_LIBRARY_REFERENCE_ID);
  if (!standard) {
    result.blockedReason = 'Regulatory Standard Library was not found for this project. Clause Register and Requirement Register were not created.';
    return result;
  }

  const standardFields = await fieldsForForm(client, standard.id);
  const standardColumns = columnIds(standardFields, CLAUSE_STANDARD_DISPLAY_KEYS, {
    standard_id: 'Standard ID',
    standard_name: 'Standard Name',
  });
  if (standardColumns.length !== CLAUSE_STANDARD_DISPLAY_KEYS.length) {
    result.blockedReason = 'Regulatory Standard Library is missing Standard ID or Standard Name, so the clause cross-reference was not configured.';
    return result;
  }

  let clause = await findForm(client, input, CLAUSE_REGISTER_REFERENCE_ID);
  if (clause) {
    await ensureRegulatoryFormFillAccess(client, clause.id, clause.permissions);
  }
  if (!clause) {
    clause = await insertRegister(client, input, createClauseRegisterBlueprint(() => crypto.randomUUID(), {
      targetFormId: standard.id,
      targetFormName: STANDARD_LIBRARY_FORM_NAME,
      displayColumns: standardColumns,
    }));
    result.clauseCreated = true;
    result.clauseForm = clause;
  } else {
    await repairCrossReference(client, clause.id, 'regulatory_standard', {
      targetFormId: standard.id,
      targetFormName: STANDARD_LIBRARY_FORM_NAME,
      displayColumns: standardColumns,
    });
  }

  const clauseFields = await fieldsForForm(client, clause.id);
  const clauseColumns = columnIds(clauseFields, REQUIREMENT_CLAUSE_DISPLAY_KEYS, {
    clause_id: 'Clause ID',
    clause_number: 'Clause Number / Reference',
    clause_title: 'Clause Title',
  });

  let requirement = await findForm(client, input, REQUIREMENT_REGISTER_REFERENCE_ID);
  if (requirement) {
    await ensureRegulatoryFormFillAccess(client, requirement.id, requirement.permissions);
  }
  if (!requirement) {
    if (clauseColumns.length !== REQUIREMENT_CLAUSE_DISPLAY_KEYS.length) {
      result.blockedReason = 'Regulatory Clause Register is missing Clause ID, Clause Number / Reference, or Clause Title, so the requirement cross-reference was not configured.';
      return result;
    }
    requirement = await insertRegister(client, input, createRequirementRegisterBlueprint(() => crypto.randomUUID(), {
      targetFormId: clause.id,
      targetFormName: CLAUSE_REGISTER_FORM_NAME,
      displayColumns: clauseColumns,
    }));
    result.requirementCreated = true;
    result.requirementForm = requirement;
  } else if (clauseColumns.length === REQUIREMENT_CLAUSE_DISPLAY_KEYS.length) {
    await repairCrossReference(client, requirement.id, 'regulatory_clause', {
      targetFormId: clause.id,
      targetFormName: CLAUSE_REGISTER_FORM_NAME,
      displayColumns: clauseColumns,
    });
  }

  return result;
}

async function findForm(
  client: { from: (table: string) => any },
  input: ProvisionRegistersInput,
  referenceId: string,
): Promise<{ id: string; permissions?: unknown } | null> {
  const { data, error } = await client
    .from('forms')
    .select('id, permissions')
    .eq('organization_id', input.organizationId)
    .eq('project_id', input.projectId)
    .eq('reference_id', referenceId);
  if (error) throw new Error(error.message || `Failed to look up ${referenceId}`);
  const row = Array.isArray(data) ? data[0] : null;
  return row?.id ? { id: row.id, permissions: row.permissions } : null;
}

async function fieldsForForm(client: { from: (table: string) => any }, formId: string) {
  const { data, error } = await client
    .from('form_fields')
    .select('id, label, field_type, custom_config')
    .eq('form_id', formId);
  if (error) throw new Error(error.message || 'Failed to load form fields');
  return Array.isArray(data) ? data : [];
}

function columnIds(
  fields: Array<{ id: string; label?: string; custom_config?: unknown }>,
  keys: readonly string[],
  labels: Record<string, string>,
): string[] {
  return keys.map((key) => {
    const match = fields.find((field) => {
      const config = parseConfig(field.custom_config);
      return config.libraryKey === key || field.label === labels[key];
    });
    return match?.id || '';
  }).filter(Boolean);
}

async function insertRegister(
  client: { from: (table: string) => any },
  input: ProvisionRegistersInput,
  blueprint: ReturnType<typeof createClauseRegisterBlueprint>,
) {
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
    throw new Error(formError?.message || `Failed to create ${blueprint.name}`);
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
  return formRow as { id: string } & Record<string, unknown>;
}

async function repairCrossReference(
  client: { from: (table: string) => any },
  formId: string,
  libraryKey: string,
  target: { targetFormId: string; targetFormName: string; displayColumns: string[] },
) {
  const fields = await fieldsForForm(client, formId);
  const field = fields.find((row) => parseConfig(row.custom_config).libraryKey === libraryKey);
  if (!field) return;
  const config = parseConfig(field.custom_config);
  if (config.targetFormId === target.targetFormId && Array.isArray(config.displayColumns) && config.displayColumns.length > 0) {
    return;
  }
  const { error } = await client.from('form_fields').update({
    custom_config: JSON.stringify({
      ...config,
      libraryKey,
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
