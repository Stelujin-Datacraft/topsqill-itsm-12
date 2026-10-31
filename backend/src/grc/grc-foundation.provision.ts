import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  GRC_FOUNDATION_CALCULATIONS,
  GRC_FOUNDATION_CATALOG,
  GRC_FOUNDATION_LINKS,
  GRC_FOUNDATION_OUTPUT_TOOLTIPS,
  GRC_LEGACY_SCORING_TOOLTIP,
} from './grc-foundation.catalog';

type CatalogForm = (typeof GRC_FOUNDATION_CATALOG)[number];
type CatalogField = CatalogForm['fields'][number];
type CatalogLink = (typeof GRC_FOUNDATION_LINKS)[number];
type CatalogCalculation = (typeof GRC_FOUNDATION_CALCULATIONS)[number];

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
  tooltip?: string | null;
  field_order?: number | null;
}

interface PageRow {
  id: string;
  name?: string;
  order?: number;
  fields: string[];
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

    try {
      await wireCalculations(client, known);
    } catch (error) {
      result.errors.push(`calculation query fields (${project.id}): ${error instanceof Error ? error.message : String(error)}`);
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

const TEMPLATE_TOKEN = /\{\{(form|field)(?::([^}]+))?\}\}/g;

function resolveTemplate(
  template: string,
  formId: (referenceId?: string) => string | undefined,
  fieldId: (key: string, referenceId?: string) => string | undefined,
): string | null {
  let missing = false;
  const resolved = template.replace(TEMPLATE_TOKEN, (_token, kind: string, body?: string) => {
    const parts = (body || '').split(':');
    const id = kind === 'form'
      ? formId(body)
      : parts.length > 1 ? fieldId(parts[1], parts[0]) : fieldId(parts[0]);
    if (!id) missing = true;
    return id || '';
  });
  return missing ? null : resolved;
}

function calculationConfig(calc: CatalogCalculation, query: string, watchFieldId: string) {
  return {
    libraryKey: calc.key,
    query,
    executeOn: calc.executeOn,
    targetFieldId: watchFieldId,
    displayMode: 'data',
    showResults: true,
    maxResults: 10,
    refreshInterval: 0,
    enableValidation: true,
  };
}

async function fieldsOf(client: SupabaseClient, formId: string): Promise<FieldRow[]> {
  const { data, error } = await client
    .from('form_fields')
    .select('id, form_id, custom_config, tooltip, field_order')
    .eq('form_id', formId);
  if (error) throw new Error(error.message);
  return (data || []) as FieldRow[];
}

/**
 * Adds the asset calculation query fields (UPDATE FORM ... WHERE submission_id = @submission_id)
 * to new and existing Asset Assessment Questionnaire and Asset Register forms.
 * A query field that already has SQL is left alone, so builder edits are kept.
 */
async function wireCalculations(client: SupabaseClient, known: Map<string, string>) {
  const fieldCache = new Map<string, FieldRow[]>();
  const cachedFields = async (formId: string) => {
    if (!fieldCache.has(formId)) fieldCache.set(formId, await fieldsOf(client, formId));
    return fieldCache.get(formId)!;
  };
  const idsByKey = async (formId: string) =>
    new Map((await cachedFields(formId)).map((row) => [libraryKeyOf(row.custom_config), row.id]));

  for (const referenceId of new Set(GRC_FOUNDATION_CALCULATIONS.map((calc) => calc.formReferenceId))) {
    const formId = known.get(referenceId);
    if (!formId) continue;
    const fields = await cachedFields(formId);
    const own = await idsByKey(formId);
    const others = new Map<string, Map<string | undefined, string>>();
    for (const [otherReference, otherId] of known) {
      if (otherReference !== referenceId) others.set(otherReference, await idsByKey(otherId));
    }

    const { data: formRow, error: formError } = await client.from('forms').select('pages').eq('id', formId).single();
    if (formError) throw new Error(formError.message);
    const rawPages = (formRow as { pages?: unknown } | null)?.pages;
    const pages = (typeof rawPages === 'string' ? JSON.parse(rawPages) : rawPages || []) as PageRow[];
    let pagesChanged = false;
    let nextOrder = fields.reduce((max, row) => Math.max(max, Number(row.field_order) || 0), 0) + 1;

    for (const calc of GRC_FOUNDATION_CALCULATIONS.filter((item) => item.formReferenceId === referenceId)) {
      const query = resolveTemplate(
        calc.query,
        (ref) => (ref ? known.get(ref) : formId),
        (key, ref) => (ref && ref !== referenceId ? others.get(ref)?.get(key) : own.get(key)),
      );
      const watchKey = 'watchKey' in calc ? calc.watchKey : undefined;
      const watchId = watchKey ? own.get(watchKey) : '';
      if (!query || watchId === undefined) continue;
      const config = calculationConfig(calc, query, watchId);

      const existing = fields.find((row) => libraryKeyOf(row.custom_config) === calc.key);
      if (existing) {
        const current = parseConfig(existing.custom_config);
        if (String(current.query || '').trim()) continue;
        const { error } = await client
          .from('form_fields')
          .update({ custom_config: { ...current, ...config } })
          .eq('id', existing.id);
        if (error) throw new Error(error.message);
        continue;
      }

      const id = randomUUID();
      const { error } = await client.from('form_fields').insert({
        id,
        form_id: formId,
        field_type: 'query-field',
        label: calc.label,
        placeholder: '',
        required: false,
        default_value: null,
        options: null,
        validation: null,
        permissions: { read: ['*'], write: ['*'] },
        triggers: [],
        is_visible: true,
        is_enabled: true,
        current_value: '',
        tooltip: calc.tooltip,
        error_message: '',
        field_order: nextOrder++,
        custom_config: config,
      });
      if (error) throw new Error(`${calc.label}: ${error.message}`);
      fields.push({ id, form_id: formId, custom_config: config, tooltip: calc.tooltip });

      const outputId = own.get(calc.outputKey);
      const page = pages.find((item) => Array.isArray(item.fields) && !!outputId && item.fields.includes(outputId))
        || pages[pages.length - 1];
      if (page) {
        const after = outputId ? page.fields.indexOf(outputId) : -1;
        page.fields.splice(after === -1 ? page.fields.length : after + 1, 0, id);
        pagesChanged = true;
      }
    }

    if (pagesChanged) {
      const { error } = await client.from('forms').update({ pages }).eq('id', formId);
      if (error) throw new Error(error.message);
    }

    for (const [key, tooltip] of Object.entries(GRC_FOUNDATION_OUTPUT_TOOLTIPS[referenceId] || {})) {
      const row = fields.find((item) => libraryKeyOf(item.custom_config) === key);
      if (!row || (row.tooltip && row.tooltip !== GRC_LEGACY_SCORING_TOOLTIP)) continue;
      const { error } = await client.from('form_fields').update({ tooltip }).eq('id', row.id);
      if (error) throw new Error(error.message);
      row.tooltip = tooltip;
    }
  }
}
