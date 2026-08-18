/**
 * Resolve approval/rejection decision option values against live form field options.
 * Prefer exact option.value so designer Selects show a selected value.
 */
import { isOptionBasedFieldType } from '@/utils/conditionOperators';

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

/**
 * Pick the best existing option for an approval/rejection/pending decision.
 * Returns the option's real `.value` (for Select binding), or a fallback hint.
 */
export function resolveDecisionOptionValue(
  field: DecisionFieldMeta | undefined,
  kind: DecisionKind,
  level?: number,
): string {
  const preferLeveled = Boolean(field?.label && /level\s*\d/i.test(field.label));
  const hint = defaultHint(kind, level, preferLeveled || Boolean(level && preferLeveled));

  if (!field || !isOptionBasedFieldType(field.type)) {
    return hint;
  }

  const options = Array.isArray(field.options) ? field.options : [];
  if (!options.length) return hint;

  // Exact / near-exact against preferred hints (leveled then generic)
  const preferredHints = [
    level ? defaultHint(kind, level, true) : '',
    defaultHint(kind, level, false),
    ...tokensFor(kind).map((t) => t.replace(/\b\w/g, (c) => c.toUpperCase())),
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
    if (exact) return String(exact.value);
  }

  // Score semantic matches (Approved ↔ Completed, etc.)
  let best: DecisionFieldOption | undefined;
  let bestScore = 0;
  for (const option of options) {
    const score = scoreOption(option, kind, level);
    if (score > bestScore) {
      bestScore = score;
      best = option;
    }
  }
  if (best && bestScore >= 20) return String(best.value);

  return hint;
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
