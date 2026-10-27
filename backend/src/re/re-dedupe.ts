/**
 * Pure helpers for lead de-duplication matching (unit-testable).
 */

export type DedupeCandidate = {
  id: string;
  phone_e164?: string | null;
  email_normalized?: string | null;
  name_normalized?: string | null;
  custom_answers?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type DedupeMatchInput = {
  phoneE164?: string | null;
  emailNormalized?: string | null;
  now?: Date;
  windowDays?: number;
};

export function isWithinDedupeWindow(
  isoDate: string | undefined,
  windowDays: number,
  now = new Date(),
): boolean {
  if (!isoDate) return true;
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return true;
  const ms = Math.max(1, windowDays) * 24 * 60 * 60 * 1000;
  return now.getTime() - t <= ms;
}

/** Exact match on normalised phone OR email within window. */
export function findExactDedupeMatch(
  candidates: DedupeCandidate[],
  input: DedupeMatchInput,
): DedupeCandidate | null {
  const windowDays = input.windowDays ?? 90;
  const now = input.now ?? new Date();
  for (const c of candidates) {
    const anchor = c.updated_at || c.created_at;
    if (!isWithinDedupeWindow(anchor, windowDays, now)) continue;
    if (input.phoneE164 && c.phone_e164 && input.phoneE164 === c.phone_e164) return c;
    if (
      input.emailNormalized &&
      c.email_normalized &&
      input.emailNormalized === c.email_normalized
    ) {
      return c;
    }
  }
  return null;
}

function localityOf(c: DedupeCandidate): string {
  const a = c.custom_answers || {};
  for (const k of Object.keys(a)) {
    if (/locality|area|location|city/i.test(k)) return String(a[k] || '').toLowerCase();
  }
  return '';
}

/** Fuzzy possibles: shared name token + locality overlap (for UI panel). */
export function findPossibleDuplicates(
  candidates: DedupeCandidate[],
  nameNormalized: string | null | undefined,
  localityHint?: string | null,
  excludeId?: string,
): DedupeCandidate[] {
  const name = String(nameNormalized || '').toLowerCase().trim();
  if (!name || name.startsWith('unknown')) return [];
  const tokens = name.split(/\s+/).filter((t) => t.length > 2);
  const loc = String(localityHint || '').toLowerCase().trim();
  return candidates.filter((c) => {
    if (excludeId && c.id === excludeId) return false;
    const cn = String(c.name_normalized || '').toLowerCase();
    if (!cn) return false;
    const nameHit = tokens.some((t) => cn.includes(t));
    if (!nameHit) return false;
    if (!loc) return true;
    const cl = localityOf(c);
    return !cl || cl.includes(loc) || loc.includes(cl);
  });
}

/** Merge empty fields from incoming into survivor snapshot (pure). */
export function mergeEmptyFields<T extends Record<string, unknown>>(
  survivor: T,
  incoming: Partial<T>,
  keys: (keyof T)[],
): Partial<T> {
  const patch: Partial<T> = {};
  for (const k of keys) {
    const cur = survivor[k];
    const next = incoming[k];
    const empty =
      cur === null ||
      cur === undefined ||
      cur === '' ||
      (typeof cur === 'object' && cur !== null && Object.keys(cur as object).length === 0);
    if (empty && next !== null && next !== undefined && next !== '') {
      patch[k] = next as T[keyof T];
    }
  }
  return patch;
}

export const FIRST_TOUCH_STATUSES = new Set(['new']);

export function shouldRestartFollowUp(leadStatus: string | null | undefined): boolean {
  return FIRST_TOUCH_STATUSES.has(String(leadStatus || 'new'));
}
