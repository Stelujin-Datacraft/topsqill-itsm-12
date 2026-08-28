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
  let s = String(raw || '').replace(/["'`]/g, '').trim();
  if (!s) return undefined;
  // Stop at common trailing action clauses —
  // never keep "Closed, set Priority to High" as a single option value
  s = s
    .replace(/[,.]?\s+(?:and\s+)?(?:then\s+)?(?:set|change|update)\s+[A-Za-z][\w\s/-]{0,40}?\s+to\b[\s\S]*$/i, '')
    .replace(/[,.]?\s+(?:and\s+)?(?:then\s+)?create\b[\s\S]*$/i, '')
    .replace(/\s+(?:then|and then|and set|and change|and update|and create)\b.*$/i, '')
    .trim();
  return s || undefined;
}

export function extractGenericPromptHints(prompt: string): GenericPromptHints {
  const text = String(prompt || '').replace(/\s+/g, ' ').trim();
  if (!text) return {};

  const out: GenericPromptHints = {};

  // when/if <field> is/equals/= <value>
  const cond = text.match(
    /\b(?:when|if)\s+([A-Za-z][\w\s/-]{0,40}?)\s+(?:is|equals|=|==)\s+([A-Za-z0-9][\w\s/-]{0,40}?)(?=\s*(?:,|\.|$|then\b|set\b|change\b|update\b|create\b|and\b))/i,
  );
  if (cond) {
    out.conditionFieldHint = cleanHint(cond[1]);
    out.conditionValueHint = cleanHint(cond[2]);
  }

  // set/change/update <field> to <value>
  const action = text.match(
    /\b(?:set|change|update)\s+([A-Za-z][\w\s/-]{0,40}?)\s+to\s+([A-Za-z0-9][\w\s/-]{0,40}?)(?=\s*(?:,|\.|$|when\b|if\b|and\b|create\b))/i,
  );
  if (action) {
    out.actionFieldHint = cleanHint(action[1]);
    out.actionValueHint = cleanHint(action[2]);
  }

  return out;
}

/** Form name hint from "create a new Incident record" / "create an Incident". */
export function extractCreateTargetFormHint(prompt: string): string | undefined {
  const text = String(prompt || '').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  const named = text.match(
    /\bcreate\s+(?:an?\s+)?(?:new\s+)?([A-Za-z][\w\s/-]{0,40}?)\s+(?:records?|tickets?|submissions?|entries)\b/i,
  );
  if (named?.[1]) {
    const hint = cleanHint(named[1]);
    if (hint && !/^(?:linked|child|cross[- ]?ref(?:erence)?)$/i.test(hint)) return hint;
  }
  const short = text.match(/\bcreate\s+(?:an?\s+)?(?:new\s+)?([A-Za-z][\w/-]{1,40})\b/i);
  if (short?.[1]) {
    const hint = cleanHint(short[1]);
    if (
      hint
      && !/^(?:a|an|new|linked|child|record|records|ticket|submission|field|form|workflow)$/i.test(hint)
    ) {
      return hint;
    }
  }
  return undefined;
}

/** Detect dual/cartesian combination mode from the prompt. */
export function inferCombinationModeFromPrompt(prompt: string): 'single' | 'dual' {
  const t = String(prompt || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (
    /\bdual\b/.test(t)
    || /\bcartesian\b/.test(t)
    || /\btwo\s+cross[- ]?ref/.test(t)
    || /\b2\s+cross[- ]?ref/.test(t)
    || /\bcross[- ]?ref.+\bcross[- ]?ref/.test(t)
    || /\bcombin(?:e|ation).+\b(?:and|with)\b.+\bcross[- ]?ref/.test(t)
  ) {
    return 'dual';
  }
  return 'single';
}

export function fieldMatchesHint(
  field: { id?: string; label?: string } | undefined,
  hint?: string,
): boolean {
  if (!field || !hint) return false;
  const a = String(field.label || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const b = hint.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!a || !b) return false;
  // Exact / token-equal only. Never let "Status" match "Marital Status"
  // or "Priority" match "Priority Score" via includes().
  return a === b;
}
