import {
  calculationFieldConfig,
  GRC_FOUNDATION_CALCULATIONS,
  resolveCalculationQuery,
} from '@/lib/grc/assetScoring';
import {
  ASSESSMENT_OUTPUT_TOOLTIPS,
  ASSET_REGISTER_OUTPUT_TOOLTIPS,
  LEGACY_SCORING_PENDING_TOOLTIP,
} from '@/lib/grc/assetScoringRule';
import { ASSET_ASSESSMENT_REFERENCE_ID, ASSET_REGISTER_REFERENCE_ID } from '@/lib/grc/foundationCatalog';
import { newRegulatoryId } from '@/lib/regulatory/regulatoryFormAccess';

type DbClient = { from: (table: string) => any };
type FieldRow = Record<string, any> & { id: string };
type PageRow = { id: string; name?: string; order?: number; fields: string[] };

const OUTPUT_TOOLTIPS: Record<string, Readonly<Record<string, string>>> = {
  [ASSET_ASSESSMENT_REFERENCE_ID]: ASSESSMENT_OUTPUT_TOOLTIPS,
  [ASSET_REGISTER_REFERENCE_ID]: ASSET_REGISTER_OUTPUT_TOOLTIPS,
};

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

const libraryKeyOf = (row: FieldRow) => parseJson<Record<string, any>>(row.custom_config, {}).libraryKey;

async function fieldsOf(client: DbClient, formId: string): Promise<FieldRow[]> {
  const { data, error } = await client.from('form_fields').select('*').eq('form_id', formId);
  if (error) throw new Error(error.message || 'Failed to load form fields');
  return (data || []) as FieldRow[];
}

/**
 * Adds the asset calculation query fields to the Asset Assessment Questionnaire and Asset Register,
 * including forms created before the calculations existed. A query field that already has SQL is left
 * alone, so edits made in the form builder are kept.
 */
export async function wireGrcCalculations(
  client: DbClient,
  forms: Map<string, { id: string } & Record<string, unknown>>,
): Promise<void> {
  const fieldCache = new Map<string, FieldRow[]>();
  const cachedFields = async (formId: string) => {
    if (!fieldCache.has(formId)) fieldCache.set(formId, await fieldsOf(client, formId));
    return fieldCache.get(formId)!;
  };

  for (const referenceId of new Set(GRC_FOUNDATION_CALCULATIONS.map((calc) => calc.formReferenceId))) {
    const form = forms.get(referenceId);
    if (!form) continue;
    const fields = await cachedFields(form.id);
    const idByKey = new Map(fields.map((row) => [libraryKeyOf(row), row.id]));
    const otherIds = new Map<string, Map<string, string>>();
    for (const [otherReference, otherForm] of forms) {
      if (otherReference === referenceId) continue;
      const otherFields = await cachedFields(otherForm.id);
      otherIds.set(otherReference, new Map(otherFields.map((row) => [libraryKeyOf(row), row.id])));
    }

    const pages = parseJson<PageRow[]>(form.pages, []);
    let pagesChanged = false;
    let nextOrder = fields.reduce((max, row) => Math.max(max, Number(row.field_order) || 0), 0) + 1;

    for (const calc of GRC_FOUNDATION_CALCULATIONS.filter((item) => item.formReferenceId === referenceId)) {
      const query = resolveCalculationQuery(calc.query, {
        formId: (ref) => (ref ? forms.get(ref)?.id : form.id),
        fieldId: (key, ref) => (ref && ref !== referenceId ? otherIds.get(ref)?.get(key) : idByKey.get(key)),
      });
      const watchId = calc.watchKey ? idByKey.get(calc.watchKey) : '';
      if (!query || watchId === undefined) continue;
      const config = calculationFieldConfig(calc, query, watchId);

      const existing = fields.find((row) => libraryKeyOf(row) === calc.key);
      if (existing) {
        const current = parseJson<Record<string, any>>(existing.custom_config, {});
        if (String(current.query || '').trim()) continue;
        const { error } = await client.from('form_fields')
          .update({ custom_config: JSON.stringify({ ...current, ...config }) })
          .eq('id', existing.id);
        if (error) throw new Error(error.message || `Failed to configure ${calc.label}`);
        continue;
      }

      const id = newRegulatoryId();
      const { error } = await client.from('form_fields').insert({
        id,
        form_id: form.id,
        field_type: 'query-field',
        label: calc.label,
        placeholder: '',
        required: false,
        default_value: null,
        options: null,
        validation: null,
        permissions: JSON.stringify({ read: ['*'], write: ['*'] }),
        triggers: JSON.stringify([]),
        is_visible: true,
        is_enabled: true,
        current_value: '',
        tooltip: calc.tooltip,
        error_message: '',
        field_order: nextOrder++,
        custom_config: JSON.stringify(config),
      });
      if (error) throw new Error(error.message || `Failed to add ${calc.label}`);
      fields.push({ id, custom_config: config });

      const outputId = idByKey.get(calc.outputKey);
      const page = pages.find((item) => Array.isArray(item.fields) && outputId && item.fields.includes(outputId))
        || pages[pages.length - 1];
      if (page) {
        const after = outputId ? page.fields.indexOf(outputId) : -1;
        page.fields.splice(after === -1 ? page.fields.length : after + 1, 0, id);
        pagesChanged = true;
      }
    }

    if (pagesChanged) {
      const { error } = await client.from('forms').update({ pages: JSON.stringify(pages) }).eq('id', form.id);
      if (error) throw new Error(error.message || 'Failed to place calculation fields');
      form.pages = JSON.stringify(pages);
    }

    for (const [key, tooltip] of Object.entries(OUTPUT_TOOLTIPS[referenceId] || {})) {
      const row = fields.find((item) => libraryKeyOf(item) === key);
      if (!row || (row.tooltip && row.tooltip !== LEGACY_SCORING_PENDING_TOOLTIP)) continue;
      const { error } = await client.from('form_fields').update({ tooltip }).eq('id', row.id);
      if (error) throw new Error(error.message || 'Failed to update calculated field help');
      row.tooltip = tooltip;
    }
  }
}
