/**
 * Metadata discovery — use live form fields / existing workflows as source of truth.
 * Never invent fields; only match or report missing.
 */
import { matchFormFieldByHint, type InferFormField } from '@/lib/ai/inferWorkflowIntent';
import { isOptionBasedFieldType } from '@/utils/conditionOperators';

export interface DiscoveredFormField {
  id: string;
  label: string;
  type: string;
  options?: Array<{ id?: string; value: string; label: string }>;
  required?: boolean;
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

export function suggestDecisionFields(form: DiscoveredForm | undefined): DiscoveredFormField[] {
  return (form?.fields || []).filter((f) => isDecisionCompatibleFieldType(f.type));
}

export function findMissingOptionValues(
  field: DiscoveredFormField | undefined,
  requiredLabels: string[],
): string[] {
  if (!field || !requiredLabels.length) return [];
  const opts = field.options || [];
  return requiredLabels.filter((label) => {
    const key = label.toLowerCase();
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
