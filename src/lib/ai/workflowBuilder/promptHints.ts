/**
 * Extract condition/action field + value hints from a natural-language workflow prompt.
 * Used so "when Status is Closed, set Priority to High" auto-fills values and can
 * prompt to create missing options (e.g. Closed on Status).
 */
export interface GenericPromptHints {
  conditionFieldHint?: string;
  conditionValueHint?: string;
  actionFieldHint?: string;
  actionValueHint?: string;
}

function cleanHint(raw: string | undefined): string | undefined {
  const s = String(raw || '').replace(/["'`]/g, '').trim();
  if (!s) return undefined;
  // Stop at common trailing clauses
  return s.replace(/\s+(?:then|and then|and set|and change|and update)\b.*$/i, '').trim() || undefined;
}

export function extractGenericPromptHints(prompt: string): GenericPromptHints {
  const text = String(prompt || '').replace(/\s+/g, ' ').trim();
  if (!text) return {};

  const out: GenericPromptHints = {};

  // when/if <field> is/equals/= <value>
  const cond = text.match(
    /\b(?:when|if)\s+([A-Za-z][\w\s/-]{0,40}?)\s+(?:is|equals|=|==)\s+([A-Za-z0-9][\w\s/-]{0,40}?)(?=\s*(?:,|\.|$|then\b|set\b|change\b|update\b|and\b))/i,
  );
  if (cond) {
    out.conditionFieldHint = cleanHint(cond[1]);
    out.conditionValueHint = cleanHint(cond[2]);
  }

  // set/change/update <field> to <value>
  const action = text.match(
    /\b(?:set|change|update)\s+([A-Za-z][\w\s/-]{0,40}?)\s+to\s+([A-Za-z0-9][\w\s/-]{0,40}?)(?=\s*(?:,|\.|$|when\b|if\b|and\b))/i,
  );
  if (action) {
    out.actionFieldHint = cleanHint(action[1]);
    out.actionValueHint = cleanHint(action[2]);
  }

  return out;
}

export function fieldMatchesHint(
  field: { id?: string; label?: string } | undefined,
  hint?: string,
): boolean {
  if (!field || !hint) return false;
  const a = String(field.label || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const b = hint.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}
