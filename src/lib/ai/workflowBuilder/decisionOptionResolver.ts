/**
 * Resolve approval/rejection decision option values against live form field options.
 * Prefer existing option.value so designer Selects show a selected value.
 * Never invent values when the field already has options — reuse or report missing.
 */
import { isOptionBasedFieldType } from '@/utils/conditionOperators';
import { isSystemStatusField, SYSTEM_STATUS_FIELD_LABEL } from '@/lib/systemStatusField';

export interface DecisionFieldOption {
  id?: string;
  value: string;
  label: string;
}

export interface DecisionFieldMeta {
  id: string;
  label: string;
  type: string;
  options?: DecisionFieldOption[];
  custom_config?: Record<string, unknown> | null;
  customConfig?: Record<string, unknown> | null;
}

export type DecisionKind = 'approved' | 'rejected' | 'pending';

const APPROVED_TOKENS = [
  'approved', 'approve', 'accepted', 'accept', 'completed', 'complete',
  'passed', 'pass', 'success', 'successful', 'yes', 'ok', 'done',
];
const REJECTED_TOKENS = [
  'rejected', 'reject', 'denied', 'deny', 'failed', 'fail',
  'cancelled', 'canceled', 'declined', 'decline', 'no', 'archived',
];
const PENDING_TOKENS = [
  'pending', 'inprogress', 'in progress', 'draft', 'submitted', 'waiting', 'open',
];

function norm(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function compact(s: string): string {
  return norm(s).replace(/\s+/g, '');
}

function tokensFor(kind: DecisionKind): string[] {
  if (kind === 'approved') return APPROVED_TOKENS;
  if (kind === 'rejected') return REJECTED_TOKENS;
  return PENDING_TOKENS;
}

function defaultHint(kind: DecisionKind, level?: number, preferLeveled?: boolean): string {
  const base = kind === 'approved' ? 'Approved' : kind === 'rejected' ? 'Rejected' : 'Pending';
  if (preferLeveled && level) return `${base} Level ${level}`;
  return base;
}

function scoreOption(option: DecisionFieldOption, kind: DecisionKind, level?: number): number {
  const label = norm(option.label);
  const value = norm(option.value);
  const joined = `${label} ${value}`;
  const joinedCompact = compact(joined);
  const tokens = tokensFor(kind);
  let score = 0;

  if (level) {
    const leveled = norm(`${tokens[0]} level ${level}`);
    if (label === leveled || value === leveled || joined.includes(`level ${level}`)) {
      score += 50;
    }
  }

  for (const token of tokens) {
    const t = norm(token);
    const tc = compact(token);
    if (label === t || value === t) score += 40;
    else if (joined.includes(t) || joinedCompact.includes(tc)) score += 20;
  }

  return score;
}

/** System Status / lifecycle field — never create options on it. */
export function isProtectedStatusField(field?: {
  id?: string;
  label?: string | null;
  type?: string | null;
  field_type?: string | null;
  custom_config?: unknown;
  customConfig?: Record<string, unknown> | null;
} | null): boolean {
  if (!field) return false;
  if (isSystemStatusField(field)) return true;
  const label = norm(field.label || '');
  return label === norm(SYSTEM_STATUS_FIELD_LABEL)
    || label === 'lifecycle status'
    || label === 'record status';
}

/** True when the field already has an option that can serve as this decision kind. */
export function hasExistingDecisionOption(
  field: DecisionFieldMeta | undefined,
  kind: DecisionKind,
  level?: number,
): boolean {
  return Boolean(findExistingDecisionOption(field, kind, level));
}

export function findExistingDecisionOption(
  field: DecisionFieldMeta | undefined,
  kind: DecisionKind,
  level?: number,
): DecisionFieldOption | undefined {
  if (!field || !isOptionBasedFieldType(field.type)) return undefined;
  const options = Array.isArray(field.options) ? field.options.filter((o) => String(o.value || o.label || '').trim()) : [];
  if (!options.length) return undefined;

  const preferLeveled = Boolean(field.label && /level\s*\d/i.test(field.label));
  const preferredHints = [
    level && (preferLeveled || true) ? defaultHint(kind, level, true) : '',
    defaultHint(kind, level, false),
    ...tokensFor(kind),
  ].filter(Boolean);

  for (const preferred of preferredHints) {
    const p = norm(preferred);
    const pc = compact(preferred);
    const exact = options.find((o) =>
      norm(o.value) === p
      || norm(o.label) === p
      || compact(o.value) === pc
      || compact(o.label) === pc,
    );
    if (exact) return exact;
  }

  let best: DecisionFieldOption | undefined;
  let bestScore = 0;
  for (const option of options) {
    const score = scoreOption(option, kind, level);
    if (score > bestScore) {
      bestScore = score;
      best = option;
    }
  }
  if (best && bestScore >= 20) return best;
  return undefined;
}

/**
 * Pick the best existing option for an approval/rejection/pending decision.
 * When the field has options: only return a real option.value (never invent).
 * When the field has no options: return a create hint (caller may add it — never on Status).
 */
export function resolveDecisionOptionValue(
  field: DecisionFieldMeta | undefined,
  kind: DecisionKind,
  level?: number,
): string {
  const preferLeveled = Boolean(field?.label && /level\s*\d/i.test(field.label));
  const hint = defaultHint(kind, level, preferLeveled);

  const existing = findExistingDecisionOption(field, kind, level);
  if (existing) return String(existing.value);

  const options = Array.isArray(field?.options) ? field!.options : [];
  // Field already has options but nothing matches — do not invent a fake Select value
  if (field && isOptionBasedFieldType(field.type) && options.length > 0) {
    return '';
  }

  // Empty option list (or non-option field): hint for optional create (caller must skip Status)
  if (isProtectedStatusField(field)) return '';
  return hint;
}

/**
 * Labels that still need to be created on a non-Status decision field.
 * Returns [] when existing options already cover approved/rejected (and pending when useful).
 */
export function missingDecisionOptionLabels(
  field: DecisionFieldMeta | undefined,
  level?: number,
): string[] {
  if (!field || isProtectedStatusField(field)) return [];
  if (!isOptionBasedFieldType(field.type)) return [];

  const missing: string[] = [];
  if (!hasExistingDecisionOption(field, 'approved', level)) missing.push('Approved');
  if (!hasExistingDecisionOption(field, 'rejected', level)) missing.push('Rejected');
  if (!hasExistingDecisionOption(field, 'pending', level)) missing.push('Pending');
  return missing;
}

/**
 * Force-bind condition node values to real option.value strings from live form fields.
 */
export function bindConditionNodesToDecisionValues(
  nodes: any[],
  formFields: DecisionFieldMeta[],
): any[] {
  if (!Array.isArray(nodes) || !formFields.length) return nodes;

  const byId = new Map(formFields.map((f) => [f.id, f]));
  const byLabel = new Map(
    formFields.map((f) => [norm(f.label), f]),
  );

  const resolveField = (fieldId?: string, fieldLabel?: string) => {
    if (fieldId && byId.has(fieldId)) return byId.get(fieldId);
    if (fieldLabel && byLabel.has(norm(fieldLabel))) return byLabel.get(norm(fieldLabel));
    return undefined;
  };

  const bindValue = (raw: unknown, field: DecisionFieldMeta | undefined): string => {
    if (!field) return String(raw ?? '');
    const existing = findExistingDecisionOption(field, 'approved')
      || findExistingDecisionOption(field, 'rejected')
      || findExistingDecisionOption(field, 'pending');
    // Prefer matching the requested hint first
    const requested = String(raw ?? '').trim();
    if (requested) {
      const asApproved = /approv|complete|accept|pass|yes|success|done/i.test(requested);
      const asRejected = /reject|deny|fail|cancel|archiv|no|declin/i.test(requested);
      const asPending = /pend|draft|wait|open|progress|submit/i.test(requested);
      const kind: DecisionKind = asRejected ? 'rejected' : asPending && !asApproved ? 'pending' : 'approved';
      const match = findExistingDecisionOption(field, kind)
        || findExistingDecisionOption(field, 'approved');
      if (match) return String(match.value);
      // Exact option match
      const exact = (field.options || []).find((o) =>
        norm(o.value) === norm(requested) || norm(o.label) === norm(requested),
      );
      if (exact) return String(exact.value);
    }
    if (existing) return String(existing.value);
    return requested;
  };

  return nodes.map((node) => {
    if (String(node?.type || '').toLowerCase() !== 'condition') return node;
    const config = { ...(node.config || {}) };
    const field = resolveField(config.fieldId, config.fieldLabel);
    if (!field) return node;

    const nextValue = bindValue(config.value, field);
    config.fieldId = field.id;
    config.fieldLabel = field.label;
    config.fieldType = field.type;
    config.value = nextValue;

    const enhanced = config.enhancedCondition;
    if (enhanced?.conditions?.length) {
      config.enhancedCondition = {
        ...enhanced,
        conditions: enhanced.conditions.map((item: any) => {
          const flc = { ...(item.fieldLevelCondition || item) };
          const flcField = resolveField(flc.fieldId, flc.fieldLabel) || field;
          const value = bindValue(flc.value ?? nextValue, flcField);
          return {
            ...item,
            fieldLevelCondition: {
              ...flc,
              formId: flc.formId || config.formId,
              fieldId: flcField.id,
              fieldLabel: flcField.label,
              fieldType: flcField.type,
              value,
            },
          };
        }),
        fieldLevelCondition: undefined,
      };
      const first = config.enhancedCondition.conditions[0]?.fieldLevelCondition;
      if (first) {
        config.enhancedCondition.fieldLevelCondition = first;
        config.value = first.value;
        config.fieldId = first.fieldId;
        config.fieldLabel = first.fieldLabel;
        config.fieldType = first.fieldType;
      }
    } else if (enhanced?.fieldLevelCondition) {
      const flc = { ...enhanced.fieldLevelCondition };
      const value = bindValue(flc.value ?? nextValue, field);
      config.enhancedCondition = {
        ...enhanced,
        fieldLevelCondition: {
          ...flc,
          fieldId: field.id,
          fieldLabel: field.label,
          fieldType: field.type,
          value,
        },
      };
      config.value = value;
    }

    return { ...node, config };
  });
}

/** Expand approval/rejection synonyms for option matchers. */
export function expandDecisionSynonyms(raw: string): string[] {
  const key = norm(raw);
  if (!key) return [];
  const out = new Set<string>([key, compact(raw)]);
  const groups = [APPROVED_TOKENS, REJECTED_TOKENS, PENDING_TOKENS];
  for (const group of groups) {
    if (group.some((t) => key === norm(t) || compact(key) === compact(t) || key.includes(norm(t)))) {
      group.forEach((t) => {
        out.add(norm(t));
        out.add(compact(t));
      });
    }
  }
  return [...out];
}
