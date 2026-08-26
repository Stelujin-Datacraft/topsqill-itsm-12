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

/** Phrases that mean "create something" but not a form record. */
function looksLikeNonRecordCreate(t: string): boolean {
  return /\bcreate\s+(?:an?\s+)?(?:new\s+)?(?:field|option|value|workflow|form|level|approver|user|role|group|status|dropdown|email|notification|rule)\b/.test(t);
}

export function inferActionTypeFromPrompt(prompt: string): InferredWorkflowActionType {
  const t = String(prompt || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t) return 'change_field_value';

  // Combination first (most specific)
  if (
    /\bcombin(?:e|ation|ations)\b/.test(t)
    || /\bcreate\s+combination\b/.test(t)
    || /\bcombination\s+record/.test(t)
    || /\bparent\b.+\bcross[- ]?ref|\bcross[- ]?ref.+\bparent\b/.test(t)
  ) {
    return 'create_combination_records';
  }

  // Update linked
  if (
    /\bupdate\s+linked\b/.test(t)
    || /\bupdate\s+(?:the\s+)?(?:linked|child|cross[- ]?ref(?:erence)?)\b/.test(t)
    || /\bupdate\b.+\b(?:linked|cross[- ]?ref(?:erence)?)\s+record/.test(t)
    || /\bset\b.+\bon\s+(?:the\s+)?linked\b/.test(t)
  ) {
    return 'update_linked_records';
  }

  // Create linked
  if (
    /\bcreate\s+linked\b/.test(t)
    || /\bcreate\s+(?:a\s+)?(?:linked|child|cross[- ]?ref(?:erence)?)\s+record/.test(t)
    || /\blinked\s+record\b/.test(t)
    || /\bcross[- ]?reference\b.+\bcreate|\bcreate\b.+\bcross[- ]?reference\b/.test(t)
  ) {
    return 'create_linked_record';
  }

  // Create record (new submission on a form)
  // Allow form/object names between "new" and "record":
  // e.g. "create a new Incident record", "create an Incident ticket"
  if (
    !looksLikeNonRecordCreate(t)
    && (
      /\bcreate\s+(?:an?\s+)?(?:new\s+)?record\b/.test(t)
      || /\bcreate\s+(?:an?\s+)?(?:new\s+)?[\w][\w\s/-]{0,40}?\s+records?\b/.test(t)
      || /\bnew\s+record\b/.test(t)
      || /\bcreate\s+(?:an?\s+)?submission\b/.test(t)
      || /\bcreate\s+(?:an?\s+)?(?:new\s+)?[\w][\w\s/-]{0,40}?\s+(?:ticket|submission|entry)\b/.test(t)
      || /\bcreate\s+(?:an?\s+)?new\s+[\w][\w/-]+\b/.test(t)
      // "create an Incident" / "create a Task" (form-like noun, not "create a field")
      || /\bcreate\s+(?:an?\s+)(?!new\b)[a-z][\w/-]{1,40}\b/.test(t)
    )
  ) {
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
      return 'Create Combination Record (combine parent + cross-reference values into a new record)';
    case 'send_notification':
      return 'Send Notification';
    default:
      return actionType;
  }
}
