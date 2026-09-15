/**
 * Infer designer Action Type from natural-language prompt keywords.
 * Never ask the user to pick — guess from related wording.
 */
export type InferredWorkflowActionType =
  | 'change_field_value'
  | 'create_record'
  | 'create_linked_record'
  | 'update_linked_records'
  | 'create_combination_records'
  | 'send_notification';

/** Cross-ref / linked / child wording used by Create/Update Linked actions. */
const CROSS_REF_NOUN =
  '(?:cross\\s*-?\\s*refs?(?:erence)?s?|crossrefs?|x-?refs?|\\bxrs?\\b|linked|child)';

/** Phrases that mean "create something" but not a form record. */
function looksLikeNonRecordCreate(t: string): boolean {
  return /\bcreate\s+(?:an?\s+)?(?:new\s+)?(?:field|option|value|workflow|form|level|approver|user|role|group|status|dropdown|email|notification|rule)\b/.test(t);
}

/** Nouns that must not be treated as a form name for bare "create an X". */
function looksLikeBareCreateNoun(t: string): boolean {
  // "create an Incident" / "create a Task" — but not cross/linked/child/etc.
  const m = t.match(/\bcreate\s+(?:an?\s+)(?!new\b)([a-z][\w/-]{1,40})\b/i);
  if (!m?.[1]) return false;
  const noun = m[1].toLowerCase();
  if (
    /^(?:cross|crossref|xref|xr|linked|child|parent|combination|combo|record|records|ticket|tickets|submission|submissions|entry|entries|field|form|workflow|action)$/.test(noun)
  ) {
    return false;
  }
  return true;
}

/** Explicit create-record / create-records wording (incl. plurals & action-type mentions). */
function looksLikeCreateRecord(t: string): boolean {
  if (looksLikeNonRecordCreate(t)) return false;
  // Never steal cross-ref / linked create prompts
  if (looksLikeCreateLinkedRecord(t) || looksLikeUpdateLinkedRecord(t)) return false;

  // Direct plurals / singulars: "create record(s)", "creating records", "new records"
  if (
    /\bcreat(?:e|ing|es)\s+(?:an?\s+)?(?:new\s+)?records?\b/.test(t)
    || /\bnew\s+records?\b/.test(t)
    || /\bcreat(?:e|ing)\s+(?:an?\s+)?submission\b/.test(t)
  ) {
    return true;
  }

  // Explicit action-type wording: "create record action", "action type create record"
  if (
    /\bcreate[_\s-]?records?\s+action\b/.test(t)
    || /\baction\s+type\s*(?:is|:|=)?\s*create[_\s-]?records?\b/.test(t)
    || /\buse\s+create[_\s-]?records?\b/.test(t)
    || /\badd\s+(?:a\s+)?create[_\s-]?records?\b/.test(t)
  ) {
    return true;
  }

  // Named form/object between create and record(s)/ticket/…
  if (
    /\bcreate\s+(?:an?\s+)?(?:new\s+)?[\w][\w\s/-]{0,40}?\s+records?\b/.test(t)
    || /\bcreate\s+(?:an?\s+)?(?:new\s+)?[\w][\w\s/-]{0,40}?\s+(?:ticket|submission|entry|tickets|submissions|entries)\b/.test(t)
    || /\bcreate\s+(?:an?\s+)?new\s+[\w][\w/-]+\b/.test(t)
    || looksLikeBareCreateNoun(t)
  ) {
    return true;
  }

  return false;
}

function looksLikeUpdateLinkedRecord(t: string): boolean {
  // Explicit action-type wording
  if (
    /\bupdate[_\s-]?linked[_\s-]?records?\s+action\b/.test(t)
    || /\baction\s+type\s*(?:is|:|=)?\s*update[_\s-]?linked[_\s-]?records?\b/.test(t)
    || /\buse\s+update[_\s-]?linked[_\s-]?records?\b/.test(t)
    || /\bupdate\s+cross\s*-?\s*refs?(?:erence)?\s+action\b/.test(t)
  ) {
    return true;
  }

  // "update/set/change … on/via cross-ref / linked / child"
  if (
    /\bupdate\s+linked\b/.test(t)
    || /\bupdate\s+(?:the\s+)?(?:linked|child)\b/.test(t)
    || new RegExp(`\\bupdate\\s+(?:the\\s+)?${CROSS_REF_NOUN}\\b`).test(t)
    || new RegExp(`\\bupdate\\b.{0,60}\\b(?:linked|child|${CROSS_REF_NOUN})\\s+records?\\b`).test(t)
    || new RegExp(`\\b(?:set|change|update)\\b.{0,40}\\bon\\s+(?:the\\s+)?${CROSS_REF_NOUN}\\b`).test(t)
    || new RegExp(`\\b(?:set|change|update)\\b.{0,40}\\bon\\s+(?:the\\s+)?(?:linked|child)\\s+records?\\b`).test(t)
    || /\bset\b.+\bon\s+(?:the\s+)?linked\b/.test(t)
  ) {
    return true;
  }

  return false;
}

function looksLikeCreateLinkedRecord(t: string): boolean {
  // Explicit action-type wording
  if (
    /\bcreate[_\s-]?linked[_\s-]?records?\s+action\b/.test(t)
    || /\baction\s+type\s*(?:is|:|=)?\s*create[_\s-]?linked[_\s-]?records?\b/.test(t)
    || /\buse\s+create[_\s-]?linked[_\s-]?records?\b/.test(t)
    || /\badd\s+(?:a\s+)?create[_\s-]?linked[_\s-]?records?\b/.test(t)
    || /\bcreate\s+cross\s*-?\s*refs?(?:erence)?\s+action\b/.test(t)
  ) {
    return true;
  }

  // "create linked/child/cross-ref (record)"
  if (
    /\bcreate\s+linked\b/.test(t)
    || /\bcreate\s+(?:an?\s+)?(?:new\s+)?(?:linked|child)\s+records?\b/.test(t)
    || new RegExp(`\\bcreat(?:e|ing)\\s+(?:an?\\s+)?(?:new\\s+)?${CROSS_REF_NOUN}\\b`).test(t)
    || new RegExp(`\\bcreat(?:e|ing)\\s+(?:an?\\s+)?(?:new\\s+)?${CROSS_REF_NOUN}\\s+records?\\b`).test(t)
    || /\blinked\s+records?\b/.test(t)
    || new RegExp(`\\b${CROSS_REF_NOUN}\\b.{0,40}\\bcreat(?:e|ing)\\b|\\bcreat(?:e|ing)\\b.{0,40}\\b${CROSS_REF_NOUN}\\b`).test(t)
  ) {
    return true;
  }

  return false;
}

export function inferActionTypeFromPrompt(prompt: string): InferredWorkflowActionType {
  const t = String(prompt || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t) return 'change_field_value';

  // Combination first (most specific)
  if (
    /\bcombin(?:e|ation|ations)\b/.test(t)
    || /\bcreate\s+combination\b/.test(t)
    || /\bcombination\s+record/.test(t)
    || /\bcartesian\b/.test(t)
    || (/\bparent\b/.test(t) && /\bcross[- ]?refs?(?:erence)?\b|\bxrs?\b/.test(t) && /\bcombin|fan-?out|cartesian\b/.test(t))
  ) {
    return 'create_combination_records';
  }

  // Update linked / cross-ref (before create so "update cross ref" wins)
  if (looksLikeUpdateLinkedRecord(t)) {
    return 'update_linked_records';
  }

  // Create linked / cross-ref (before plain create_record)
  if (looksLikeCreateLinkedRecord(t)) {
    return 'create_linked_record';
  }

  // Create record (new submission on a form) — before change_field so
  // "create a record and set Title to X" still becomes create_record.
  if (looksLikeCreateRecord(t)) {
    return 'create_record';
  }

  // Notifications / approval notify steps
  if (
    /\bnotif(?:y|ication)|send\s+(?:an?\s+)?(?:email|sms|alert)|approv(?:e|al)\s+request\b/.test(t)
    && !/\bchange\s+field|\bset\s+.+\s+to\b|\bupdate\s+field\b/.test(t)
  ) {
    return 'send_notification';
  }

  // Default / change field value
  if (
    /\bchange\s+field|\bset\s+field|\bupdate\s+field|\bset\s+.+\s+to\b|\bchange\s+.+\s+to\b|\bupdate\s+.+\s+to\b|\bfield\s+value\b/.test(t)
  ) {
    return 'change_field_value';
  }

  // Approval-heavy prompts without explicit field update → notification
  if (/\bapprov|\breview\b|\bmulti[- ]?level\b/.test(t)) {
    return 'send_notification';
  }

  return 'change_field_value';
}

export function describeActionType(actionType: InferredWorkflowActionType): string {
  switch (actionType) {
    case 'change_field_value':
      return 'Change Field Value (update a field on this form)';
    case 'create_record':
      return 'Create Record (create a new record)';
    case 'create_linked_record':
      return 'Create Linked Record (create a record on the linked cross-reference form)';
    case 'update_linked_records':
      return 'Update Linked Record (update a field on the linked cross-reference form)';
    case 'create_combination_records':
      return 'Create Combination Records (fan-out new records from cross-reference links on the trigger form)';
    case 'send_notification':
      return 'Send Notification';
    default:
      return actionType;
  }
}
