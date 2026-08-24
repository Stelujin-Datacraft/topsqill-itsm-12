/**
 * Metadata discovery — use live form fields / existing workflows as source of truth.
 * Never invent fields; only match or report missing.
 */
import { matchFormFieldByHint, type InferFormField } from '@/lib/ai/inferWorkflowIntent';
import { isOptionBasedFieldType } from '@/utils/conditionOperators';
import {
  hasExistingDecisionOption,
  isProtectedStatusField,
  missingDecisionOptionLabels,
  resolvePreferredOptionValue,
  fieldHasPreferredOption,
  sanitizeConditionValueHint,
} from './decisionOptionResolver';

export interface DiscoveredFormField {
  id: string;
  label: string;
  type: string;
  options?: Array<{ id?: string; value: string; label: string }>;
  required?: boolean;
  /** Parsed custom_config — used for cross-reference target form resolution */
  custom_config?: Record<string, any> | null;
}

export interface DiscoveredForm {
  id: string;
  name: string;
  fields: DiscoveredFormField[];
}

export interface DiscoveredWorkflow {
  id: string;
  name: string;
  description?: string;
}

export interface FieldMatchResult {
  query: string;
  matched: DiscoveredFormField | null;
  candidates: DiscoveredFormField[];
}

const APPROVER_FIELD_TYPES = new Set([
  'user-picker',
  'user_picker',
  'user',
  'assignee',
  'submission-access',
  'submission_access',
  'group-picker',
  'group_picker',
  'email',
]);

const DECISION_FIELD_TYPES = new Set([
  'select',
  'radio',
  'dropdown',
  'multi-select',
  'toggle',
  'checkbox',
  'approval',
  'text',
]);

export function isApproverCompatibleFieldType(type: string): boolean {
  const t = String(type || '').toLowerCase().replace(/[_\s]+/g, '-');
  return APPROVER_FIELD_TYPES.has(t) || APPROVER_FIELD_TYPES.has(type.toLowerCase());
}

export function isDecisionCompatibleFieldType(type: string): boolean {
  const t = String(type || '').toLowerCase().replace(/[_\s]+/g, '-');
  return DECISION_FIELD_TYPES.has(t) || isOptionBasedFieldType(type);
}

export function toInferFields(fields: DiscoveredFormField[]): InferFormField[] {
  return (fields || []).map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    options: f.options,
  }));
}

export function searchFields(
  form: DiscoveredForm | undefined,
  query: string,
): FieldMatchResult {
  const fields = form?.fields || [];
  const q = String(query || '').trim();
  if (!q || !fields.length) {
    return { query: q, matched: null, candidates: [] };
  }

  const matched = matchFormFieldByHint(toInferFields(fields), q);
  const matchedFull = matched
    ? fields.find((f) => f.id === matched.id) || null
    : null;

  const key = q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const candidates = fields.filter((f) => {
    const n = f.label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return n.includes(key) || key.includes(n) || n.split(' ').some((t) => key.includes(t));
  }).slice(0, 5);

  return { query: q, matched: matchedFull, candidates };
}

export function suggestApproverFields(form: DiscoveredForm | undefined): DiscoveredFormField[] {
  return (form?.fields || []).filter((f) => isApproverCompatibleFieldType(f.type));
}

export function suggestCrossReferenceFields(form: DiscoveredForm | undefined): DiscoveredFormField[] {
  return (form?.fields || []).filter((f) => {
    const t = String(f.type || '').toLowerCase().replace(/[_\s]+/g, '-');
    return t === 'cross-reference' || t === 'child-cross-reference';
  });
}

/** Resolve a user answer to a real option.value when the field has options. */
export function resolveFieldOptionValue(
  field: DiscoveredFormField | undefined,
  answer: unknown,
): string {
  // Sanitize first — never lock onto "Closed, Set Priority To High" when Closed exists
  return resolvePreferredOptionValue(field, answer);
}

export function fieldOptionChoices(
  field: DiscoveredFormField | undefined,
): Array<{ value: string; label: string }> {
  return (field?.options || []).map((o) => ({
    value: String(o.value),
    label: String(o.label || o.value),
  }));
}

/** True when the field already has this option (by value or label). Exact match after sanitize. */
export function fieldHasOption(
  field: DiscoveredFormField | undefined,
  answer: unknown,
): boolean {
  // "Closed, Set Priority To High" → treat as Closed if that option exists
  if (fieldHasPreferredOption(field, answer)) return true;
  const sanitized = sanitizeConditionValueHint(String(answer ?? ''));
  if (!sanitized || !field) return false;
  // Fallback: exact match on sanitized text against any option (including legacy)
  const key = sanitized.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return (field.options || []).some((o) => {
    const v = String(o.value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const l = String(o.label || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return (v && v === key) || (l && l === key);
  });
}

/** True when the field is option-based (dropdown/select/radio/etc.). */
export function fieldNeedsOptionCreateCheck(field: DiscoveredFormField | undefined): boolean {
  if (!field) return false;
  return isOptionBasedFieldType(field.type);
}

/** True when the field is option-based and already has at least one option. */
export function fieldHasSelectableOptions(field: DiscoveredFormField | undefined): boolean {
  return Boolean(field && Array.isArray(field.options) && field.options.length > 0);
}

/**
 * Ensure system Status (and similar) expose selectable options for AI Suggest.
 * If DB options are empty but the field is option-based Status, hydrate defaults.
 */
export function hydrateDiscoveredFieldOptions(field: DiscoveredFormField): DiscoveredFormField {
  const opts = Array.isArray(field.options) ? field.options.filter((o) =>
    String(o.value || o.label || '').trim(),
  ) : [];
  if (opts.length) {
    return { ...field, options: opts };
  }
  if (!isOptionBasedFieldType(field.type)) return field;

  const label = String(field.label || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const isStatus = label === 'status' || label === 'lifecycle status' || label === 'record status'
    || isProtectedStatusField(field);
  if (!isStatus) return { ...field, options: opts };

  // Lazy import avoided — use shared system defaults via decisionOptionResolver's status check only.
  // Inline the standard lifecycle options so AI can detect missing ones like Closed.
  const defaults = [
    { value: 'Draft', label: 'Draft' },
    { value: 'Inprogress', label: 'Inprogress' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Archived', label: 'Archived' },
  ];
  return { ...field, options: defaults };
}

export function hydrateDiscoveredForm(form: DiscoveredForm | undefined): DiscoveredForm | undefined {
  if (!form) return undefined;
  return {
    ...form,
    fields: (form.fields || []).map(hydrateDiscoveredFieldOptions),
  };
}

export function getCrossRefTargetForm(field: DiscoveredFormField | undefined): {
  targetFormId?: string;
  targetFormName?: string;
} {
  if (!field) return {};
  const cfg = field.custom_config || {};
  const nested = cfg.crossRefConfig || cfg.cross_ref_config || cfg;
  return {
    targetFormId: nested.targetFormId || nested.target_form_id || cfg.targetFormId,
    targetFormName: nested.targetFormName || nested.target_form_name || cfg.targetFormName,
  };
}

export function suggestDecisionFields(form: DiscoveredForm | undefined): DiscoveredFormField[] {
  return (form?.fields || []).filter((f) =>
    isDecisionCompatibleFieldType(f.type)
    && !isProtectedStatusField(f),
  );
}

export function findMissingOptionValues(
  field: DiscoveredFormField | undefined,
  requiredLabels: string[],
): string[] {
  if (!field || !requiredLabels.length) return [];
  // Never treat Status as missing values we should create
  if (isProtectedStatusField(field)) return [];
  return requiredLabels.filter((label) => {
    const kind = /reject/i.test(label) ? 'rejected' as const
      : /pend/i.test(label) ? 'pending' as const
        : 'approved' as const;
    // Semantic reuse: Completed covers Approved, etc.
    if (hasExistingDecisionOption(field, kind)) return false;
    const key = label.toLowerCase();
    const opts = field.options || [];
    return !opts.some((o) =>
      String(o.value).toLowerCase() === key
      || String(o.label).toLowerCase() === key,
    );
  });
}

export function findExistingWorkflowsForForm(
  workflows: DiscoveredWorkflow[],
  formName?: string,
): DiscoveredWorkflow[] {
  if (!formName) return workflows.slice(0, 5);
  const key = formName.toLowerCase();
  return workflows.filter((w) =>
    w.name.toLowerCase().includes(key)
    || (w.description || '').toLowerCase().includes(key)
    || w.name.toLowerCase().includes('approv'),
  );
}

/** Recommended decision values for a multi-level approval. */
export function recommendedDecisionValues(levelCount: number): string[] {
  const values = ['Pending', 'Approved', 'Rejected'];
  if (levelCount <= 1) return values;
  const leveled: string[] = [];
  for (let i = 1; i <= levelCount; i++) {
    leveled.push(`Pending Level ${i}`, `Approved Level ${i}`, `Rejected Level ${i}`);
  }
  return leveled;
}
