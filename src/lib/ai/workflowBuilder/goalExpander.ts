/**
 * Expand short natural-language workflow goals into an internal plan/brief.
 * Keeps the user's short prompt as the source of truth for field/option binding
 * (Closed, High, etc.) — never glues action text into option values.
 */
import { analyzeWorkflowIntent, type IntentAnalysisResult } from './intentAnalyzer';
import { extractGenericPromptHints, type GenericPromptHints } from './promptHints';
import { isApprovalStyleDefinition } from './types';
import { sanitizeConditionValueHint } from './decisionOptionResolver';

export interface ExpandedWorkflowGoal {
  /** Original user text — use for option/field binding and asset planning */
  originalPrompt: string;
  /** Structured brief for suggest-workflow LLM only */
  llmBrief: string;
  analysis: IntentAnalysisResult;
  hints: GenericPromptHints;
  /** True when the prompt was short and we expanded it */
  didExpand: boolean;
}

function wordCount(text: string): number {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function isShortGoal(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  // Long scripted prompts already describe nodes — don't re-expand aggressively
  if (wordCount(t) > 60) return false;
  if (/\b(start|wait|end)\b.+\b(condition|action|notify)\b/i.test(t) && wordCount(t) > 40) {
    return false;
  }
  return true;
}

function buildApprovalBrief(
  original: string,
  analysis: IntentAnalysisResult,
  formName?: string,
): string {
  const levels = analysis.definition.levels || [];
  const levelLines = levels.map((l) => {
    const hint = l.approver?.rawHint || l.approver?.fieldLabel;
    return hint
      ? `- Level ${l.level}: notify approver field/hint "${hint}", wait for decision, condition on Status == Approved`
      : `- Level ${l.level}: notify Level ${l.level} approver, wait for decision, condition on Status == Approved`;
  });

  const reject = analysis.definition.defaultRejection?.action
    || levels.find((l) => l.onRejection)?.onRejection?.action
    || 'RETURN_TO_REQUESTER';

  return [
    `User goal (short — expand this into a complete workflow; do NOT copy as option labels):`,
    `"${original}"`,
    '',
    `Internal plan:`,
    `- Type: ${analysis.definition.workflowType.replace(/_/g, ' ')}`,
    formName ? `- Trigger form: ${formName}` : '- Trigger: form submission',
    `- Levels: ${levels.length || 2}`,
    ...levelLines,
    `- On rejection: ${reject} (notify submitter; do not invent Status values)`,
    `- Final success: END completed`,
    '',
    `Node types allowed: start, action, condition, wait, end only.`,
    `Action types: send_notification for approver notify; change_field_value only when user asked to set/change a field.`,
    `CRITICAL: Use exact option values from form metadata only.`,
    `Never concatenate the user goal into a single option label. Keep Status values and Priority values as separate short tokens.`,
    `If user mentioned Closed / High / Approved, keep those as separate exact values.`,
  ].join('\n');
}

function buildGenericBrief(
  original: string,
  analysis: IntentAnalysisResult,
  hints: GenericPromptHints,
  formName?: string,
): string {
  const actionType = analysis.definition.action?.actionType || 'change_field_value';
  const condField = hints.conditionFieldHint || '(ask / match form field)';
  const condValue = sanitizeConditionValueHint(hints.conditionValueHint || '') || '(exact value from goal)';
  const actionField = hints.actionFieldHint || '(ask / match form field)';
  const actionValue = sanitizeConditionValueHint(hints.actionValueHint || '') || '(exact value from goal)';

  return [
    `User goal (short — expand this into a complete workflow; do NOT copy as option labels):`,
    `"${original}"`,
    '',
    `Internal plan:`,
    formName ? `- Trigger form: ${formName}` : '- Trigger: form submission',
    `- Pattern: start → condition → action → end (with false path to end/skip)`,
    `- Condition: ${condField} equals ${condValue}`,
    `- Action type: ${actionType}`,
    actionType === 'change_field_value'
      ? `- Action: set ${actionField} to ${actionValue}`
      : `- Action: ${actionType} using form cross-ref / target form metadata when needed`,
    '',
    `Node types allowed: start, action, condition, wait, end only.`,
    `CRITICAL: Field values must be exact and separate (condition value and action value are different fields).`,
    `Prefer existing form fields and options. If an option is missing, emit the exact short value only.`,
    `Never invent option labels by joining sentences from the user goal.`,
  ].join('\n');
}

/**
 * Expand a short workflow goal for LLM suggest-workflow, while preserving the
 * original prompt for binding/create-option logic.
 */
export function expandShortWorkflowGoal(
  prompt: string,
  context?: {
    formId?: string;
    formName?: string;
  },
): ExpandedWorkflowGoal {
  const originalPrompt = String(prompt || '').replace(/\s+/g, ' ').trim();
  const analysis = analyzeWorkflowIntent(originalPrompt, context);
  const hints = extractGenericPromptHints(originalPrompt);
  // Always sanitize hint values so expansion never re-introduces glued labels
  if (hints.conditionValueHint) {
    hints.conditionValueHint = sanitizeConditionValueHint(hints.conditionValueHint) || hints.conditionValueHint;
  }
  if (hints.actionValueHint) {
    hints.actionValueHint = sanitizeConditionValueHint(hints.actionValueHint) || hints.actionValueHint;
  }

  if (!originalPrompt) {
    return {
      originalPrompt,
      llmBrief: originalPrompt,
      analysis,
      hints,
      didExpand: false,
    };
  }

  const short = isShortGoal(originalPrompt);
  const approval = isApprovalStyleDefinition(analysis.definition);

  if (!short) {
    // Still append binding guardrails for long prompts without rewriting them
    const llmBrief = [
      originalPrompt,
      '',
      'Guardrails: use exact form option values; never join the goal into one option label.',
    ].join('\n');
    return { originalPrompt, llmBrief, analysis, hints, didExpand: false };
  }

  const llmBrief = approval
    ? buildApprovalBrief(originalPrompt, analysis, context?.formName)
    : buildGenericBrief(originalPrompt, analysis, hints, context?.formName);

  return {
    originalPrompt,
    llmBrief,
    analysis,
    hints,
    didExpand: true,
  };
}
