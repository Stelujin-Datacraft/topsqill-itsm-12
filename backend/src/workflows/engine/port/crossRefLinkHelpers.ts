/**
 * Pure helpers for cross-reference link matching / dedupe.
 * Shared by Link Existing Record and reusable in tests.
 */

export type CrossRefLinkEntry =
  | string
  | {
    id?: string;
    submission_ref_id?: string;
    form_id?: string;
    [key: string]: unknown;
  };

export interface MatchFieldMapping {
  sourceFieldId?: string;
  targetFieldId?: string;
}

export interface ChildSubmissionCandidate {
  id: string;
  submission_ref_id?: string | null;
  submission_data?: Record<string, any> | null;
}

/** Normalize values for Parent↔Child equality checks. */
export function normalizeComparableValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => normalizeComparableValue(v)).filter(Boolean).join(',');
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.submission_ref_id != null) return normalizeComparableValue(obj.submission_ref_id);
    if (obj.id != null) return normalizeComparableValue(obj.id);
    if (obj.value != null) return normalizeComparableValue(obj.value);
    try {
      return JSON.stringify(obj);
    } catch {
      return String(value);
    }
  }
  return String(value).trim();
}

/** True when every mapping's parent source equals the child target field. */
export function submissionMatchesMappings(
  parentData: Record<string, any>,
  childData: Record<string, any>,
  mappings: MatchFieldMapping[],
): boolean {
  const complete = (mappings || []).filter((m) => m.sourceFieldId && m.targetFieldId);
  if (!complete.length) return false;
  for (const m of complete) {
    const parentVal = normalizeComparableValue(parentData[m.sourceFieldId!]);
    const childVal = normalizeComparableValue(childData[m.targetFieldId!]);
    if (!parentVal || parentVal !== childVal) return false;
  }
  return true;
}

/** Collect existing link identity keys from an XR field value. */
export function extractLinkedIdentityKeys(xrValue: unknown): Set<string> {
  const keys = new Set<string>();
  const push = (v: unknown) => {
    const n = normalizeComparableValue(v);
    if (n) keys.add(n);
  };
  if (xrValue == null || xrValue === '') return keys;
  const list = Array.isArray(xrValue) ? xrValue : [xrValue];
  for (const item of list) {
    if (typeof item === 'string' || typeof item === 'number') {
      push(item);
      continue;
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      push(o.submission_ref_id);
      push(o.id);
      push(o.value);
    }
  }
  return keys;
}

/**
 * Append a child record to an XR field value without duplicates.
 * Prefers rich `{ id, submission_ref_id, form_id }` entries when the existing
 * value already uses objects; otherwise appends submission_ref_id strings.
 */
export function appendCrossRefLink(
  currentXrValue: unknown,
  record: { id: string; submission_ref_id?: string | null },
  formId?: string,
): { value: CrossRefLinkEntry[]; added: boolean; alreadyLinked: boolean } {
  const existingKeys = extractLinkedIdentityKeys(currentXrValue);
  const ref = record.submission_ref_id || '';
  const id = record.id || '';
  const alreadyLinked = Boolean(
    (ref && existingKeys.has(normalizeComparableValue(ref)))
    || (id && existingKeys.has(normalizeComparableValue(id))),
  );

  const asList = ((): CrossRefLinkEntry[] => {
    if (Array.isArray(currentXrValue)) return [...currentXrValue] as CrossRefLinkEntry[];
    if (currentXrValue == null || currentXrValue === '') return [];
    return [currentXrValue as CrossRefLinkEntry];
  })();

  if (alreadyLinked) {
    return { value: asList, added: false, alreadyLinked: true };
  }

  const prefersObjects = asList.some((item) => item && typeof item === 'object');
  if (prefersObjects || formId) {
    asList.push({
      id: record.id,
      submission_ref_id: record.submission_ref_id || undefined,
      form_id: formId,
    });
  } else if (ref) {
    asList.push(ref);
  } else if (id) {
    asList.push(id);
  } else {
    return { value: asList, added: false, alreadyLinked: false };
  }

  return { value: asList, added: true, alreadyLinked: false };
}

/** Find matching child submissions for Parent→Child field mappings. */
export function findMatchingChildRecords(
  parentData: Record<string, any>,
  candidates: ChildSubmissionCandidate[],
  mappings: MatchFieldMapping[],
  matchScope: 'first' | 'all' = 'first',
): ChildSubmissionCandidate[] {
  const matches: ChildSubmissionCandidate[] = [];
  for (const candidate of candidates) {
    const data = (candidate.submission_data && typeof candidate.submission_data === 'object')
      ? candidate.submission_data
      : {};
    if (!submissionMatchesMappings(parentData, data, mappings)) continue;
    matches.push(candidate);
    if (matchScope === 'first') break;
  }
  return matches;
}
