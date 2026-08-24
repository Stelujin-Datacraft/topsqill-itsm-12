/**
 * Plan and apply form field/option creates for AI-generated workflows.
 * Existing fields are reused; missing ones are planned first (for confirm UI), then created.
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
  isCreateEntityPrompt,
  matchFormFieldByHint,
  parseConditionPredicates,
  parseFieldUpdates,
  type InferFormField,
} from '@/lib/ai/inferWorkflowIntent';
import { sanitizeAiFieldType } from '@/lib/createFormFromAiGeneration';
import { isOptionBasedFieldType } from '@/utils/conditionOperators';
import {
  findExistingDecisionOption,
  inferDecisionKindFromText,
  type DecisionKind,
  sanitizeConditionValueHint,
  isPollutedOptionLabel,
  fieldHasPreferredOption,
} from '@/lib/ai/workflowBuilder/decisionOptionResolver';

/** Labels that are command noise, not real form fields (e.g. prompt started with "create"). */
const META_PLANNED_FIELD_LABELS = new Set([
  'create', 'make', 'build', 'generate', 'design', 'add', 'new', 'please',
  'workflow', 'workflows', 'form', 'forms', 'automation', 'automate',
  'set', 'change', 'update', 'a', 'an', 'the', 'my', 'our',
  'start', 'end', 'action', 'condition', 'notification',
]);

function isPlannableFieldLabel(label: string): boolean {
  const key = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!key || key.length < 2) return false;
  if (META_PLANNED_FIELD_LABELS.has(key)) return false;
  const first = key.split(/\s+/)[0];
  if (/^(create|make|build|generate|design)$/.test(first)) return false;
  return true;
}

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

export interface PlannedFieldCreate {
  label: string;
  type: string;
  /** Option labels to seed when the field is option-based */
  options: string[];
  reason: string;
}

export interface PlannedOptionCreate {
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  valueLabel: string;
  reason: string;
}

export interface WorkflowAssetPlan {
  formId: string;
  formName?: string;
  fieldsToCreate: PlannedFieldCreate[];
  optionsToCreate: PlannedOptionCreate[];
  reusedFields: string[];
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
  if (/^[A-Za-z][A-Za-z0-9 _-]{0,24}$/.test(raw) && raw.split(/\s+/).length <= 3) {
    return 'select';
  }
  return 'text';
}

function humanizeFieldType(type: string): string {
  const t = sanitizeAiFieldType(type);
  const map: Record<string, string> = {
    text: 'Text',
    textarea: 'Long text',
    number: 'Number',
    date: 'Date',
    datetime: 'Date & time',
    select: 'Dropdown',
    radio: 'Radio',
    checkbox: 'Checkbox',
    toggle: 'Toggle',
    email: 'Email',
    phone: 'Phone',
  };
  return map[t] || t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function reasonForSource(source: string): string {
  if (source === 'condition') return 'Referenced by a condition';
  if (source === 'action') return 'Referenced by Change Field Value';
  return 'Detected from your prompt';
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
          value: typeof flc.value === 'string' ? sanitizeConditionValueHint(flc.value) || flc.value : flc.value,
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

  void formId;
  return out;
}

function collectRequirementsFromPrompt(prompt: string): Array<{ label: string; type: string; value?: unknown; source: 'prompt' }> {
  // "Create a workflow…" is not a request to insert form fields
  if (isCreateEntityPrompt(prompt)) return [];

  const preds = parseConditionPredicates(prompt);
  const updates = parseFieldUpdates(prompt);
  const out: Array<{ label: string; type: string; value?: unknown; source: 'prompt' }> = [];
  for (const p of preds) {
    const value = sanitizeConditionValueHint(p.valueHint);
    out.push({
      label: canonicalizeFieldLabel(p.fieldHint),
      type: inferFieldTypeFromValue(value || p.valueHint),
      value: value || undefined,
      source: 'prompt',
    });
  }
  for (const u of updates) {
    // Action values are already isolated by parseFieldUpdates; still scrub glued clauses
    const value = sanitizeConditionValueHint(u.valueHint) || u.valueHint;
    out.push({
      label: canonicalizeFieldLabel(u.fieldHint),
      type: inferFieldTypeFromValue(value),
      value,
      source: 'prompt',
    });
  }
  return out;
}

function mergeRequirements(
  ...lists: Array<Array<{ label: string; type: string; value?: unknown; source: string }>>
): Array<{ label: string; type: string; values: unknown[]; reasons: string[] }> {
  const map = new Map<string, { label: string; type: string; values: unknown[]; reasons: string[] }>();
  for (const list of lists) {
    for (const item of list) {
      const key = item.label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!key) continue;
      const reason = reasonForSource(item.source);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          label: item.label,
          type: item.type,
          values: item.value !== undefined && item.value !== '' ? [item.value] : [],
          reasons: [reason],
        });
      } else {
        if (existing.type === 'text' && item.type !== 'text') existing.type = item.type;
        if (item.value !== undefined && item.value !== '') existing.values.push(item.value);
        if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
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

function uniqueLabels(values: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const raw = sanitizeConditionValueHint(String(v ?? ''));
    if (!raw) continue;
    // Never plan glued prompt junk / generated opt ids as new options
    if (isPollutedOptionLabel(raw)) continue;
    if (/^opt_\d+$/i.test(raw)) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  return out;
}

/**
 * Only reuse Approved/Rejected/Pending semantics for labels that actually look like
 * decision states. Never map arbitrary values like "Closed" or "High" → Completed.
 */
function decisionKindForOptionLabel(label: string): DecisionKind | null {
  return inferDecisionKindFromText(label);
}

function optionAlreadyExists(
  field: { type?: string; options?: Array<{ value?: string; label?: string }> },
  label: string,
): boolean {
  // Sanitize so "Closed, Set Priority To High" counts as Closed when Closed exists
  if (fieldHasPreferredOption(field as any, label)) return true;
  const key = sanitizeConditionValueHint(label).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!key) return false;
  return (field.options || []).some((o) => {
    if (isPollutedOptionLabel(String(o.label || '')) || isPollutedOptionLabel(String(o.value || ''))) {
      return false;
    }
    const v = String(o.value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const l = String(o.label || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return (v && v === key) || (l && l === key);
  });
}

/**
 * Analyze prompt + nodes and return what would be created (no mutations).
 */
export function planMissingWorkflowFormAssets(params: {
  nodes: any[];
  forms: EnsureFormAssetForm[];
  defaultFormId?: string;
  userPrompt?: string;
}): WorkflowAssetPlan | null {
  const formId = params.defaultFormId || params.forms[0]?.id;
  if (!formId || !Array.isArray(params.nodes) || params.nodes.length === 0) {
    return null;
  }

  const formFieldsByFormId = buildConditionFieldsByFormId(params.forms);
  const fields = formFieldsByFormId[formId] || [];
  const formName = params.forms.find((f) => f.id === formId)?.name;

  const requirements = mergeRequirements(
    collectRequirementsFromNodes(params.nodes, formId),
    params.userPrompt ? collectRequirementsFromPrompt(params.userPrompt) : [],
  );

  const fieldsToCreate: PlannedFieldCreate[] = [];
  const optionsToCreate: PlannedOptionCreate[] = [];
  const reusedFields: string[] = [];

  for (const req of requirements) {
    if (!isPlannableFieldLabel(req.label)) continue;

    const matched = matchFormFieldByHint(toInferFields(fields), req.label)
      || fields.find((f) => f.label.toLowerCase() === req.label.toLowerCase());

    const reason = req.reasons.join('; ');
    const optionLabels = uniqueLabels(req.values);

    if (matched) {
      reusedFields.push(matched.label);
      // Allow adding missing options on Status too — user confirms before create.
      // Do not invent new Status fields; only append missing option values.
      if (isOptionBasedFieldType(matched.type)) {
        const opts = matched.options || [];
        for (const label of optionLabels) {
          if (optionAlreadyExists(matched, label)) continue;
          // Semantic reuse only for real decision words (Approved/Rejected/Pending),
          // never map "Closed" → Completed or "High" → anything.
          const kind = decisionKindForOptionLabel(label);
          if (kind && findExistingDecisionOption(matched, kind)) continue;
          // Avoid duplicate planned options
          if (optionsToCreate.some((o) =>
            o.fieldId === matched.id && o.valueLabel.toLowerCase() === label.toLowerCase()
          )) continue;
          optionsToCreate.push({
            fieldId: matched.id,
            fieldLabel: matched.label,
            fieldType: matched.type,
            valueLabel: label,
            reason,
          });
        }
      }
      continue;
    }

    // Also check if already planned as a new field
    const alreadyPlanned = fieldsToCreate.find(
      (f) => f.label.toLowerCase() === req.label.toLowerCase(),
    );
    if (alreadyPlanned) {
      for (const label of optionLabels) {
        if (!alreadyPlanned.options.some((o) => o.toLowerCase() === label.toLowerCase())) {
          alreadyPlanned.options.push(label);
        }
      }
      continue;
    }

    fieldsToCreate.push({
      label: req.label,
      type: req.type,
      options: isOptionBasedFieldType(req.type) ? optionLabels : [],
      reason,
    });
  }

  // Include resolveWorkflowConditions issues not already covered (UUID-only labels, etc.)
  const { issues } = resolveWorkflowConditions(
    params.nodes,
    formFieldsByFormId,
    formId,
  );
  for (const issue of issues as ConditionResolutionIssue[]) {
    if (issue.kind === 'missing_field') {
      const label = canonicalizeFieldLabel(issue.requestedLabel);
      if (!isPlannableFieldLabel(label)) continue;
      if (fieldsToCreate.some((f) => f.label.toLowerCase() === label.toLowerCase())) continue;
      if (matchFormFieldByHint(toInferFields(fields), label)) continue;
      const optionLabels = uniqueLabels(
        issue.value !== undefined && issue.value !== '' ? [issue.value] : [],
      );
      fieldsToCreate.push({
        label,
        type: sanitizeAiFieldType(issue.requestedType),
        options: isOptionBasedFieldType(issue.requestedType) ? optionLabels : [],
        reason: 'Referenced by a condition',
      });
    } else if (issue.kind === 'missing_value') {
      const issueField = fields.find((f) => f.id === issue.fieldId)
        || { id: issue.fieldId, label: issue.fieldLabel, type: issue.fieldType, options: issue.availableOptions };
      // Allow missing option creates on Status when the value is truly absent
      if (optionAlreadyExists(issueField, issue.requestedValue)) continue;
      const kind = decisionKindForOptionLabel(issue.requestedValue);
      if (kind && findExistingDecisionOption(issueField as any, kind)) continue;
      if (optionsToCreate.some((o) =>
        o.fieldId === issue.fieldId
        && o.valueLabel.toLowerCase() === issue.requestedValue.toLowerCase()
      )) continue;
      // Skip if the field itself is being created with this option
      const pendingField = fieldsToCreate.find(
        (f) => f.label.toLowerCase() === issue.fieldLabel.toLowerCase(),
      );
      if (pendingField) {
        const label = uniqueLabels([issue.requestedValue])[0];
        if (label && !pendingField.options.some((o) => o.toLowerCase() === label.toLowerCase())) {
          pendingField.options.push(label);
        }
        continue;
      }
      optionsToCreate.push({
        fieldId: issue.fieldId,
        fieldLabel: issue.fieldLabel,
        fieldType: issue.fieldType,
        valueLabel: uniqueLabels([issue.requestedValue])[0] || issue.requestedValue,
        reason: 'Referenced by a condition',
      });
    }
  }

  return {
    formId,
    formName,
    fieldsToCreate,
    optionsToCreate,
    reusedFields: [...new Set(reusedFields)],
  };
}

export function workflowAssetPlanHasCreates(plan: WorkflowAssetPlan | null | undefined): boolean {
  if (!plan) return false;
  return plan.fieldsToCreate.length > 0 || plan.optionsToCreate.length > 0;
}

export function describeFieldType(type: string): string {
  return humanizeFieldType(type);
}

/**
 * Apply a previously planned set of creates, then re-bind workflow nodes.
 */
export async function applyWorkflowAssetPlan(params: {
  nodes: any[];
  forms: EnsureFormAssetForm[];
  plan: WorkflowAssetPlan;
  userPrompt?: string;
}): Promise<{
  nodes: any[];
  forms: EnsureFormAssetForm[];
  summary: EnsuredAssetSummary;
}> {
  const { plan } = params;
  const formId = plan.formId;
  let formFieldsByFormId = buildConditionFieldsByFormId(params.forms);
  let fields = [...(formFieldsByFormId[formId] || [])];
  const formName = plan.formName || params.forms.find((f) => f.id === formId)?.name;
  const summary: EnsuredAssetSummary = { createdFields: [], createdOptions: [] };

  // 1) Create new fields
  for (const fieldPlan of plan.fieldsToCreate) {
    const seed = fieldPlan.options[0];
    try {
      const created = await createConditionFormField({
        formId,
        label: fieldPlan.label,
        type: fieldPlan.type,
        initialValue: isOptionBasedFieldType(fieldPlan.type) ? seed : undefined,
      });
      const meta: ConditionFormFieldMeta = {
        id: created.id,
        label: created.label,
        type: created.type,
        options: created.options,
      };
      fields = [...fields.filter((f) => f.id !== created.id), meta];
      summary.createdFields.push(created.label);

      if (isOptionBasedFieldType(created.type)) {
        for (const value of fieldPlan.options) {
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
            console.error('applyWorkflowAssetPlan: seed extra option failed', e);
          }
        }
      }
    } catch (e) {
      console.error('applyWorkflowAssetPlan: create field failed', e);
    }
  }

  // 2) Add options on existing fields
  for (const optPlan of plan.optionsToCreate) {
    const field = fields.find((f) => f.id === optPlan.fieldId)
      || fields.find((f) => f.label.toLowerCase() === optPlan.fieldLabel.toLowerCase());
    if (!field || !isOptionBasedFieldType(field.type)) continue;
    const raw = optPlan.valueLabel.trim();
    if (!raw) continue;
    if (optionAlreadyExists(field, raw)) continue;
    try {
      const created = await addConditionFieldOption({
        fieldId: field.id,
        valueLabel: raw,
      });
      field.options = created.options;
      summary.createdOptions.push({ field: field.label, value: created.label });
    } catch (e) {
      console.error('applyWorkflowAssetPlan: add option failed', e);
    }
  }

  formFieldsByFormId = { ...formFieldsByFormId, [formId]: fields };

  // 3) Re-bind AI nodes
  let nodes = enrichWorkflowNodesFromPrompt(
    params.nodes,
    params.userPrompt || '',
    toInferFields(fields),
    { formId, formName },
  );

  // 4) Resolve remaining condition issues (safety net — should be rare after plan apply)
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
          console.error('applyWorkflowAssetPlan: safety create field failed', e);
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
          console.error('applyWorkflowAssetPlan: safety create value failed', e);
        }
      }
    }
    if (!createdSomething) break;
  }

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

/**
 * Re-bind nodes when nothing needs to be created (existing fields only).
 */
export function rebindWorkflowNodesToFormAssets(params: {
  nodes: any[];
  forms: EnsureFormAssetForm[];
  defaultFormId?: string;
  userPrompt?: string;
}): { nodes: any[]; forms: EnsureFormAssetForm[] } {
  const formId = params.defaultFormId || params.forms[0]?.id;
  if (!formId) return { nodes: params.nodes, forms: params.forms };

  const formFieldsByFormId = buildConditionFieldsByFormId(params.forms);
  const fields = formFieldsByFormId[formId] || [];
  const formName = params.forms.find((f) => f.id === formId)?.name;

  let nodes = enrichWorkflowNodesFromPrompt(
    params.nodes,
    params.userPrompt || '',
    toInferFields(fields),
    { formId, formName },
  );
  const resolved = resolveWorkflowConditions(nodes, formFieldsByFormId, formId);
  nodes = enrichWorkflowNodesFromPrompt(
    resolved.nodes,
    params.userPrompt || '',
    toInferFields(fields),
    { formId, formName },
  );
  return { nodes, forms: params.forms };
}

/**
 * Create any missing form fields/options (no confirm) then re-bind.
 * Prefer plan + confirm + applyWorkflowAssetPlan for interactive UX.
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
  const plan = planMissingWorkflowFormAssets(params);
  if (!workflowAssetPlanHasCreates(plan)) {
    const rebound = rebindWorkflowNodesToFormAssets(params);
    return {
      nodes: rebound.nodes,
      forms: rebound.forms,
      summary: { createdFields: [], createdOptions: [] },
    };
  }
  return applyWorkflowAssetPlan({
    nodes: params.nodes,
    forms: params.forms,
    plan: plan!,
    userPrompt: params.userPrompt,
  });
}
