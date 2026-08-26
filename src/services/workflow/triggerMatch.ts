/**
 * Shared helpers for matching form submissions to workflow Start nodes.
 * Designer UI accepts triggerFormId | formId | sourceFormId; runtime must too.
 */

export function parseWorkflowNodeConfig(config: unknown): Record<string, any> {
  if (typeof config === 'string') {
    try {
      const parsed = JSON.parse(config);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return config && typeof config === 'object' ? (config as Record<string, any>) : {};
}

/** Resolve the form this Start node listens to (aliases used across AI / designer). */
export function resolveStartTriggerFormId(config: Record<string, any> | null | undefined): string {
  if (!config) return '';
  return String(
    config.triggerFormId
    || config.formId
    || config.sourceFormId
    || config.trigger_form_id
    || '',
  ).trim();
}

/**
 * Normalize trigger type synonyms to runtime tokens.
 * DB workflow_triggers uses onFormSubmit; Start config uses form_submission.
 */
export function normalizeFormTriggerType(raw: unknown): string {
  const t = String(raw || 'form_submission').toLowerCase().replace(/[\s-]+/g, '_');
  if (
    t === 'form_submission'
    || t === 'onformsubmit'
    || t === 'form'
    || t === 'trigger'
    || t === 'submission'
  ) {
    return 'form_submission';
  }
  if (t === 'form_completion' || t === 'onformcompletion') {
    return 'form_completion';
  }
  return t;
}

export function isFormSubmissionTriggerType(raw: unknown): boolean {
  const t = normalizeFormTriggerType(raw);
  return t === 'form_submission' || t === 'form_completion';
}

/** True when this Start node should fire for the given form submission. */
export function startNodeMatchesFormSubmission(
  config: Record<string, any> | null | undefined,
  formId: string,
): boolean {
  if (!formId) return false;
  if (!isFormSubmissionTriggerType(config?.triggerType)) return false;
  return resolveStartTriggerFormId(config) === formId;
}
