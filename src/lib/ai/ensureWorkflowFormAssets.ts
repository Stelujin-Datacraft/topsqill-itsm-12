/**
 * Ensure form fields/options exist for an AI-generated workflow.
 * Uses existing fields when present; creates missing ones so the workflow can complete.
 */
import {
  addConditionFieldOption,
  buildConditionFieldsByFormId,
  createConditionFormField,
} from '@/lib/ai/conditionFormMutations';
import {
  applyConditionResolutionToNodes,
  resolveWorkflowConditions,
  type ConditionFormFieldMeta,
  type ConditionResolutionIssue,
} from '@/lib/ai/resolveWorkflowConditions';
import {
  enrichWorkflowNodesFromPrompt,
  matchFormFieldByHint,
  parseConditionPredicates,
  parseFieldUpdates,
  type InferFormField,
} from '@/lib/ai/inferWorkflowIntent';
import { sanitizeAiFieldType } from '@/lib/createFormFromAiGeneration';
import { isOptionBasedFieldType } from '@/utils/conditionOperators';

export interface EnsureFormAssetForm {
  id: string;
  name?: string;
  fields?: Array<{
    id: string;
    label: string;
    type: string;
    options?: Array<{ id?: string; value: string; label: string }>;
    required?: boolean;
  }>;
}

export interface EnsuredAssetSummary {
  createdFields: string[];
  createdOptions: Array<{ field: string; value: string }>;
}

function canonicalizeFieldLabel(label: string): string {
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const map: Record<string, string> = {
    dob: 'Date of Birth',
    'date of birth': 'Date of Birth',
    birthdate: 'Date of Birth',
    'birth date': 'Date of Birth',
    birthday: 'Date of Birth',
    gender: 'Gender',
    sex: 'Gender',
    'marital status': 'Marital Status',
    marital: 'Marital Status',
    'marriage status': 'Marital Status',
  };
  return map[key] || label.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferFieldTypeFromValue(value: unknown, hintType?: string): string {
  if (hintType) return sanitizeAiFieldType(hintType);
  const raw = String(value ?? '').trim();
  if (!raw) return 'text';
  if (/^(19|20)\d{2}(-\d{2}-\d{2})?$/.test(raw) || /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(raw)) {
    return 'date';
  }
  if (/^(true|false|yes|no|male|female|married|single|widowed|divorced)$/i.test(raw)) {
    return 'select';
  }
  if (/^-?\d+(\.\d+)?$/.test(raw)) return 'number';
  // Short categorical tokens → select
  if (/^[A-Za-z][A-Za-z0-9 _-]{0,24}$/.test(raw) && raw.split(/\s+/).length <= 3) {
    return 'select';
  }
  return 'text';
}

function collectRequirementsFromNodes(
  nodes: any[],
  formId: string,
): Array<{ label: string; type: string; value?: unknown; source: 'condition' | 'action' }> {
  const out: Array<{ label: string; type: string; value?: unknown; source: 'condition' | 'action' }> = [];

  for (const node of nodes || []) {
    const type = String(node?.type || '').toLowerCase();
    const config = node?.config || {};

    if (type === 'condition' || type === 'branch' || type === 'decision') {
      const enhanced = config.enhancedCondition;
      const items = Array.isArray(enhanced?.conditions) && enhanced.conditions.length
        ? enhanced.conditions
        : enhanced?.fieldLevelCondition
          ? [{ fieldLevelCondition: enhanced.fieldLevelCondition }]
          : (config.fieldId || config.fieldLabel || config.field)
            ? [{ fieldLevelCondition: config }]
            : [];

      for (const item of items) {
        const flc = item?.fieldLevelCondition || item || {};
        const label = String(flc.fieldLabel || flc.fieldName || flc.field || flc.fieldId || '').trim();
        if (!label || /^[0-9a-f-]{36}$/i.test(label)) continue;
        out.push({
          label: canonicalizeFieldLabel(label),
          type: sanitizeAiFieldType(flc.fieldType || inferFieldTypeFromValue(flc.value)),
          value: flc.value,
          source: 'condition',
        });
      }
    }

    if (type === 'action') {
      const actionType = String(config.actionType || '').toLowerCase();
      if (actionType && actionType !== 'change_field_value') continue;
      const updates = Array.isArray(config.fieldUpdates) && config.fieldUpdates.length
        ? config.fieldUpdates
        : (config.targetFieldId || config.targetFieldName || config.fieldId || config.fieldLabel)
          ? [config]
          : [];
      for (const u of updates) {
        const label = String(
          u.targetFieldName || u.fieldName || u.fieldLabel || u.targetField || '',
        ).trim();
        if (!label || /^[0-9a-f-]{36}$/i.test(label)) continue;
        out.push({
          label: canonicalizeFieldLabel(label),
          type: sanitizeAiFieldType(u.targetFieldType || u.fieldType || inferFieldTypeFromValue(u.staticValue ?? u.value)),
          value: u.staticValue ?? u.value,
          source: 'action',
        });
      }
    }
  }

  // formId unused but kept for API clarity / future multi-form
  void formId;
  return out;
}

function collectRequirementsFromPrompt(prompt: string): Array<{ label: string; type: string; value?: unknown; source: 'prompt' }> {
  const preds = parseConditionPredicates(prompt);
  const updates = parseFieldUpdates(prompt);
  const out: Array<{ label: string; type: string; value?: unknown; source: 'prompt' }> = [];
  for (const p of preds) {
    out.push({
      label: canonicalizeFieldLabel(p.fieldHint),
      type: inferFieldTypeFromValue(p.valueHint),
      value: p.valueHint,
      source: 'prompt',
    });
  }
  for (const u of updates) {
    out.push({
      label: canonicalizeFieldLabel(u.fieldHint),
      type: inferFieldTypeFromValue(u.valueHint),
      value: u.valueHint,
      source: 'prompt',
    });
  }
  return out;
}

function mergeRequirements(
  ...lists: Array<Array<{ label: string; type: string; value?: unknown; source: string }>>
): Array<{ label: string; type: string; values: unknown[] }> {
  const map = new Map<string, { label: string; type: string; values: unknown[] }>();
  for (const list of lists) {
    for (const item of list) {
      const key = item.label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!key) continue;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          label: item.label,
          type: item.type,
          values: item.value !== undefined && item.value !== '' ? [item.value] : [],
        });
      } else {
        // Prefer more specific types (date/select/number over text)
        if (existing.type === 'text' && item.type !== 'text') existing.type = item.type;
        if (item.value !== undefined && item.value !== '') existing.values.push(item.value);
      }
    }
  }
  return [...map.values()];
}

function toInferFields(fields: ConditionFormFieldMeta[]): InferFormField[] {
  return fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    options: f.options,
  }));
}

/**
 * Create any missing form fields/options referenced by the prompt or AI nodes,
 * then re-bind condition + change_field_value configs to the live metadata.
 */
export async function ensureMissingWorkflowFormAssets(params: {
  nodes: any[];
  forms: EnsureFormAssetForm[];
  defaultFormId?: string;
  userPrompt?: string;
}): Promise<{
  nodes: any[];
  forms: EnsureFormAssetForm[];
  summary: EnsuredAssetSummary;
}> {
  const formId = params.defaultFormId || params.forms[0]?.id;
  if (!formId || !Array.isArray(params.nodes) || params.nodes.length === 0) {
    return {
      nodes: params.nodes,
      forms: params.forms,
      summary: { createdFields: [], createdOptions: [] },
    };
  }

  let formFieldsByFormId = buildConditionFieldsByFormId(params.forms);
  let fields = formFieldsByFormId[formId] || [];
  const formName = params.forms.find((f) => f.id === formId)?.name;

  const requirements = mergeRequirements(
    collectRequirementsFromNodes(params.nodes, formId),
    params.userPrompt ? collectRequirementsFromPrompt(params.userPrompt) : [],
  );

  const summary: EnsuredAssetSummary = { createdFields: [], createdOptions: [] };

  // 1) Ensure fields exist
  for (const req of requirements) {
    const matched = matchFormFieldByHint(toInferFields(fields), req.label)
      || fields.find((f) => f.label.toLowerCase() === req.label.toLowerCase());

    if (matched) {
      // Ensure option values exist on option fields
      if (isOptionBasedFieldType(matched.type)) {
        for (const value of req.values) {
          const raw = String(value ?? '').trim();
          if (!raw) continue;
          const opts = matched.options || [];
          const exists = opts.some((o) =>
            String(o.value).toLowerCase() === raw.toLowerCase()
            || String(o.label).toLowerCase() === raw.toLowerCase(),
          );
          if (exists) continue;
          try {
            const created = await addConditionFieldOption({
              fieldId: matched.id,
              valueLabel: raw,
            });
            matched.options = created.options;
            summary.createdOptions.push({ field: matched.label, value: created.label });
          } catch (e) {
            console.error('ensureMissingWorkflowFormAssets: add option failed', e);
          }
        }
      }
      continue;
    }

    // Create missing field (seed first option when select-like)
    const seedValue = req.values.find((v) => String(v ?? '').trim());
    try {
      const created = await createConditionFormField({
        formId,
        label: req.label,
        type: req.type,
        initialValue: isOptionBasedFieldType(req.type) ? seedValue : undefined,
      });
      const meta: ConditionFormFieldMeta = {
        id: created.id,
        label: created.label,
        type: created.type,
        options: created.options,
      };
      fields = [...fields.filter((f) => f.id !== created.id), meta];
      summary.createdFields.push(created.label);

      // Add any additional option values beyond the seed
      if (isOptionBasedFieldType(created.type)) {
        for (const value of req.values) {
          const raw = String(value ?? '').trim();
          if (!raw) continue;
          const exists = (meta.options || []).some((o) =>
            String(o.value).toLowerCase() === raw.toLowerCase()
            || String(o.label).toLowerCase() === raw.toLowerCase(),
          );
          if (exists) continue;
          try {
            const opt = await addConditionFieldOption({ fieldId: created.id, valueLabel: raw });
            meta.options = opt.options;
            summary.createdOptions.push({ field: created.label, value: opt.label });
          } catch (e) {
            console.error('ensureMissingWorkflowFormAssets: seed extra option failed', e);
          }
        }
      }
    } catch (e) {
      console.error('ensureMissingWorkflowFormAssets: create field failed', e);
    }
  }

  formFieldsByFormId = { ...formFieldsByFormId, [formId]: fields };

  // 2) Re-bind AI nodes against updated metadata (prompt enrich + condition resolve)
  let nodes = enrichWorkflowNodesFromPrompt(
    params.nodes,
    params.userPrompt || '',
    toInferFields(fields),
    { formId, formName },
  );

  // 3) Auto-resolve remaining condition issues (create anything still missing)
  let guard = 0;
  while (guard < 8) {
    guard += 1;
    const { nodes: resolvedNodes, issues } = resolveWorkflowConditions(
      nodes,
      formFieldsByFormId,
      formId,
    );
    nodes = resolvedNodes;
    if (!issues.length) break;

    let createdSomething = false;
    for (const issue of issues as ConditionResolutionIssue[]) {
      if (issue.kind === 'missing_field') {
        try {
          const created = await createConditionFormField({
            formId: issue.formId || formId,
            label: issue.requestedLabel,
            type: issue.requestedType,
            initialValue: isOptionBasedFieldType(issue.requestedType) ? issue.value : undefined,
          });
          fields = [
            ...fields.filter((f) => f.id !== created.id),
            { id: created.id, label: created.label, type: created.type, options: created.options },
          ];
          formFieldsByFormId = { ...formFieldsByFormId, [formId]: fields };
          nodes = applyConditionResolutionToNodes(nodes, issue, {
            fieldId: created.id,
            fieldLabel: created.label,
            fieldType: created.type,
            value: isOptionBasedFieldType(created.type) && created.options[0]
              ? created.options[0].value
              : issue.value,
          });
          if (!summary.createdFields.includes(created.label)) {
            summary.createdFields.push(created.label);
          }
          createdSomething = true;
        } catch (e) {
          console.error('auto-create missing field failed', e);
        }
      } else if (issue.kind === 'missing_value') {
        try {
          const created = await addConditionFieldOption({
            fieldId: issue.fieldId,
            valueLabel: issue.requestedValue,
          });
          fields = fields.map((f) => (f.id === issue.fieldId ? { ...f, options: created.options } : f));
          formFieldsByFormId = { ...formFieldsByFormId, [formId]: fields };
          nodes = applyConditionResolutionToNodes(nodes, issue, {
            fieldId: issue.fieldId,
            fieldLabel: issue.fieldLabel,
            fieldType: issue.fieldType,
            value: created.value,
          });
          summary.createdOptions.push({ field: issue.fieldLabel, value: created.label });
          createdSomething = true;
        } catch (e) {
          console.error('auto-create missing value failed', e);
        }
      }
    }
    if (!createdSomething) break;
  }

  // Final enrich pass for change_field_value binding
  nodes = enrichWorkflowNodesFromPrompt(
    nodes,
    params.userPrompt || '',
    toInferFields(fields),
    { formId, formName },
  );

  const nextForms = params.forms.map((f) => {
    if (f.id !== formId) return f;
    return {
      ...f,
      fields: fields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type,
        options: field.options,
        required: false,
      })),
    };
  });

  return { nodes, forms: nextForms, summary };
}
