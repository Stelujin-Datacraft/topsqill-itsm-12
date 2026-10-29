import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GRC_FOUNDATION_CATALOG, GRC_FOUNDATION_LINKS } from './grc-foundation.catalog';

type CatalogForm = (typeof GRC_FOUNDATION_CATALOG)[number];
type CatalogField = CatalogForm['fields'][number];
type CatalogLink = (typeof GRC_FOUNDATION_LINKS)[number];

interface ProjectRow {
  id: string;
  organization_id: string | null;
  created_by: string | null;
}

interface FormRow {
  id: string;
  project_id: string;
  reference_id: string | null;
}

interface FieldRow {
  id: string;
  form_id: string;
  custom_config: unknown;
}

export interface FoundationProvisionResult {
  created: number;
  alreadyPresent: number;
  errors: string[];
}

const PAGE_SIZE = 1000;

function pageIdForName(name: string): string {
  return `page-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function optionId(label: string): string {
  return `opt-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function parseConfig(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

function libraryKeyOf(raw: unknown): string | undefined {
  const key = parseConfig(raw).libraryKey;
  return typeof key === 'string' ? key : undefined;
}

async function fetchPages<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await load(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/**
 * Inserts the four foundation forms into the application database.
 * Uses the service-role client so the rows land in the same project the Forms page reads.
 * Existing reference ids are left in place. Requirement Register fields are not edited.
 */
export async function provisionGrcFoundationRecords(
  client: SupabaseClient,
): Promise<FoundationProvisionResult> {
  const projects = await fetchPages<ProjectRow>((from, to) =>
    client.from('projects').select('id, organization_id, created_by').range(from, to),
  );
  const referenceIds = [
    ...GRC_FOUNDATION_CATALOG.map((form) => form.referenceId),
    ...GRC_FOUNDATION_LINKS.map((link) => link.targetReferenceId),
  ];
  const existing = await fetchPages<FormRow>((from, to) =>
    client
      .from('forms')
      .select('id, project_id, reference_id')
      .in('reference_id', referenceIds)
      .range(from, to),
  );

  const byProject = new Map<string, Map<string, string>>();
  for (const form of existing) {
    if (!form.reference_id) continue;
    const bucket = byProject.get(form.project_id) || new Map<string, string>();
    bucket.set(form.reference_id, form.id);
    byProject.set(form.project_id, bucket);
  }

  const result: FoundationProvisionResult = { created: 0, alreadyPresent: 0, errors: [] };

  for (const project of projects) {
    if (!project.organization_id || !project.created_by) continue;
    const known = byProject.get(project.id) || new Map<string, string>();
    byProject.set(project.id, known);

    for (const spec of GRC_FOUNDATION_CATALOG) {
      if (known.has(spec.referenceId)) {
        result.alreadyPresent += 1;
        continue;
      }
      try {
        const formId = await insertForm(client, project, spec);
        known.set(spec.referenceId, formId);
        result.created += 1;
      } catch (error) {
        result.errors.push(`${spec.name} (${project.id}): ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    try {
      await wireLinks(client, known);
    } catch (error) {
      result.errors.push(`cross-reference (${project.id}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return result;
}

async function insertForm(
  client: SupabaseClient,
  project: ProjectRow,
  spec: CatalogForm,
): Promise<string> {
  const fieldIds = new Map<string, string>();
  for (const field of spec.fields) fieldIds.set(field.key, randomUUID());
  const pages = spec.pages.map((name, order) => ({
    id: pageIdForName(name),
    name,
    order,
    fields: spec.fields
      .filter((field) => field.page === name)
      .map((field) => fieldIds.get(field.key) || ''),
  }));

  const { data, error } = await client
    .from('forms')
    .insert({
      name: spec.name,
      description: spec.description,
      organization_id: project.organization_id,
      project_id: project.id,
      status: 'active',
      created_by: project.created_by,
      is_public: false,
      reference_id: spec.referenceId,
      permissions: { view: ['*'], submit: ['*'], edit: ['admin'] },
      share_settings: { allowPublicAccess: false, sharedUsers: [] },
      field_rules: [],
      form_rules: [],
      layout: { columns: 2 },
      pages,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message || `Failed to create ${spec.name}`);

  const formId = String(data.id);
  const fieldRows = spec.fields.map((field, index) => fieldRow(formId, field, fieldIds.get(field.key)!, index));
  const { error: fieldError } = await client.from('form_fields').insert(fieldRows);
  if (fieldError) {
    await client.from('forms').delete().eq('id', formId);
    throw new Error(fieldError.message);
  }
  return formId;
}

function fieldRow(formId: string, field: CatalogField, id: string, index: number) {
  const options = 'options' in field && Array.isArray(field.options)
    ? field.options.map((label) => ({ id: optionId(label), value: label, label }))
    : null;
  return {
    id,
    form_id: formId,
    field_type: field.type,
    label: field.label,
    placeholder: 'placeholder' in field ? field.placeholder || '' : '',
    required: Boolean(field.required),
    default_value: 'defaultValue' in field ? field.defaultValue ?? null : null,
    options,
    validation: 'validation' in field ? field.validation ?? null : null,
    permissions: { read: ['*'], write: ['*'] },
    triggers: [],
    is_visible: true,
    is_enabled: !('enabled' in field && field.enabled === false),
    current_value: '',
    tooltip: 'tooltip' in field ? field.tooltip || '' : '',
    error_message: '',
    field_order: index,
    custom_config: { libraryKey: field.key },
  };
}

async function wireLinks(client: SupabaseClient, known: Map<string, string>) {
  for (const link of GRC_FOUNDATION_LINKS) {
    const sourceId = known.get(link.sourceReferenceId);
    const targetId = known.get(link.targetReferenceId);
    if (!sourceId || !targetId) continue;

    const { data: targetFields, error: targetError } = await client
      .from('form_fields')
      .select('id, custom_config')
      .eq('form_id', targetId);
    if (targetError) throw new Error(targetError.message);
    const displayColumns = link.displayKeys.map((key) => {
      const match = ((targetFields || []) as FieldRow[]).find((field) => libraryKeyOf(field.custom_config) === key);
      return match?.id;
    });
    if (displayColumns.some((id) => !id)) continue;

    const { data: sourceFields, error: sourceError } = await client
      .from('form_fields')
      .select('id, custom_config')
      .eq('form_id', sourceId);
    if (sourceError) throw new Error(sourceError.message);
    const sourceField = ((sourceFields || []) as FieldRow[]).find((field) => libraryKeyOf(field.custom_config) === link.libraryKey);
    if (!sourceField) continue;
    const config = parseConfig(sourceField.custom_config);
    const current = Array.isArray(config.displayColumns) ? config.displayColumns : [];
    if (config.targetFormId === targetId && current.length === displayColumns.length) continue;

    const { error } = await client
      .from('form_fields')
      .update({
        custom_config: {
          ...config,
          libraryKey: link.libraryKey,
          targetFormId: targetId,
          targetFormName: link.targetFormName,
          displayColumns,
          tableDisplayFields: displayColumns,
          hyperlinkField: displayColumns[0],
          enableSorting: true,
          enableSearch: true,
          pageSize: 10,
        },
      })
      .eq('id', sourceField.id);
    if (error) throw new Error(error.message);
  }
}
