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
 * Infer approved/rejected/pending ONLY when the text is actually a decision synonym.
 * Arbitrary lifecycle values like "Closed" or "High" must return null — never default to approved.
 */
export function inferDecisionKindFromText(raw: string): DecisionKind | null {
  const key = norm(raw);
  if (!key) return null;
  if (/\b(reject(ed|ion)?|denied|deny|declined|decline|failed|fail|cancelled|canceled|archived)\b/.test(key)) {
    return 'rejected';
  }
  if (/\b(pending|in progress|inprogress|draft|submitted|waiting|open)\b/.test(key)) {
    return 'pending';
  }
  if (/\b(approved|approve|approval|accepted|accept|completed|complete|passed|pass|success|successful|done)\b/.test(key)) {
    return 'approved';
  }
  // Exact token matches for short answers (yes/ok/no) used in approval UIs
  if (APPROVED_TOKENS.some((t) => key === norm(t) || compact(key) === compact(t))) return 'approved';
  if (REJECTED_TOKENS.some((t) => key === norm(t) || compact(key) === compact(t))) return 'rejected';
  if (PENDING_TOKENS.some((t) => key === norm(t) || compact(key) === compact(t))) return 'pending';
  return null;
}

/** Strip trailing "set/change Field to …" clauses wrongly glued onto condition values. */
export function sanitizeConditionValueHint(raw: string): string {
  return String(raw || '')
    .replace(/["'`]/g, '')
    // "Closed, set Priority to High" / "Closed Set Priority To High"
    .replace(/[,.]?\s+(?:and\s+)?(?:then\s+)?(?:set|change|update)\s+[A-Za-z][\w\s/-]{0,40}?\s+to\b[\s\S]*$/i, '')
    // "Closed, set Priority High" (missing "to")
    .replace(/[,.]?\s+(?:and\s+)?(?:then\s+)?(?:set|change|update)\s+[A-Za-z][\w\s/-]{0,60}$/i, '')
    .replace(/\s+\bthen\b[\s\S]*$/i, '')
    // Leading "if/when" leftovers: "If Closed"
    .replace(/^(?:if|when)\s+/i, '')
    .trim();
}

/** True when a label looks like a glued prompt, not a real option name. */
export function isPollutedOptionLabel(raw: string): boolean {
  const s = String(raw || '').trim();
  if (!s) return false;
  if (sanitizeConditionValueHint(s) !== s && sanitizeConditionValueHint(s).length > 0) return true;
  if (/\b(set|change|update)\b/i.test(s) && s.split(/\s+/).length > 2) return true;
  if (/^opt_\d+$/i.test(s)) return true;
  return false;
}

/**
 * Resolve requested text to an existing option.value.
 * Always sanitize first so "Closed, Set Priority To High" → prefer existing "Closed".
 * Never lock onto a polluted option when a clean match exists.
 */
export function resolvePreferredOptionValue(
  field: { type?: string; options?: DecisionFieldOption[] } | undefined,
  requested: unknown,
): string {
  const sanitized = sanitizeConditionValueHint(String(requested ?? ''));
  if (!sanitized) return '';
  if (!field) return sanitized;

  const options = Array.isArray(field.options)
    ? field.options.filter((o) => String(o.value || o.label || '').trim())
    : [];
  if (!options.length) return sanitized;

  const findExact = (hint: string): DecisionFieldOption | undefined => {
    const key = norm(hint);
    const keyC = compact(hint);
    if (!key) return undefined;
    // Prefer non-polluted options when multiple could match
    const matches = options.filter((o) =>
      norm(o.value) === key
      || norm(o.label) === key
      || compact(o.value) === keyC
      || compact(o.label) === keyC,
    );
    if (!matches.length) return undefined;
    const clean = matches.find((o) => !isPollutedOptionLabel(o.label) && !isPollutedOptionLabel(o.value));
    return clean || matches[0];
  };

  const exact = findExact(sanitized);
  if (exact) return String(exact.value);

  const kind = inferDecisionKindFromText(sanitized);
  if (kind) {
    const match = findExistingDecisionOption(field as DecisionFieldMeta, kind);
    if (match) return String(match.value);
  }

  // Do not return the raw polluted string — keep sanitized for create/bind UI
  return sanitized;
}

/** True when the field already has an option for this hint (after sanitizing). */
export function fieldHasPreferredOption(
  field: { type?: string; options?: DecisionFieldOption[] } | undefined,
  requested: unknown,
): boolean {
  const sanitized = sanitizeConditionValueHint(String(requested ?? ''));
  if (!sanitized || !field) return false;
  const options = Array.isArray(field.options) ? field.options : [];
  if (!options.length) return false;
  const key = norm(sanitized);
  const keyC = compact(sanitized);
  return options.some((o) => {
    if (isPollutedOptionLabel(String(o.label || '')) || isPollutedOptionLabel(String(o.value || ''))) {
      // Polluted options do not count as satisfying a clean request like "Closed"
      return false;
    }
    return norm(o.value) === key
      || norm(o.label) === key
      || compact(o.value) === keyC
      || compact(o.label) === keyC;
  });
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
    return resolvePreferredOptionValue(field, raw);
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
