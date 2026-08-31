/**
 * Intent analyzer — extract workflow type, levels, routing hints from NL.
 * Deterministic heuristics first; LLM can refine later.
 */
import {
  createEmptyLevel,
  createEmptyWorkflowDefinition,
  type AIWorkflowDefinition,
  type AIWorkflowType,
  type RejectionRoute,
  type WorkflowActionSpec,
  type WorkflowLevelSpec,
} from './types';
import {
  describeActionType,
  inferActionTypeFromPrompt,
  type InferredWorkflowActionType,
} from './actionTypeInferrer';
import { extractCreateTargetFormHint, inferCombinationModeFromPrompt } from './promptHints';

export interface IntentAnalysisResult {
  definition: AIWorkflowDefinition;
  /** Hints already extracted (so planner won't re-ask) */
  extractedKeys: string[];
  confidence: 'high' | 'medium' | 'low';
  needsConversation: boolean;
}

const MAX_APPROVAL_LEVELS = 8;

function detectLevelCount(text: string): number | null {
  const m = text.match(/\b(\d+)\s*[- ]?\s*levels?\b/i)
    || text.match(/\b(two|three|four|five|six|seven|eight|one)\s*[- ]?\s*levels?\b/i)
    || text.match(/\b([2-8])\s*level\b/i);
  if (!m) {
    // "Level 1 and Level 2" style
    const levels = [...text.matchAll(/\blevel\s*(\d+)\b/gi)].map((x) => Number(x[1]));
    if (levels.length) {
      return Math.min(MAX_APPROVAL_LEVELS, Math.max(...levels));
    }
    return null;
  }
  const raw = m[1].toLowerCase();
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  };
  const n = words[raw] || Number(raw) || null;
  if (!n || !Number.isFinite(n)) return null;
  return Math.max(1, Math.min(MAX_APPROVAL_LEVELS, n));
}

function detectWorkflowType(text: string): AIWorkflowType {
  const t = text.toLowerCase();
  if (/\bparallel\b|\bindependently\b|\bat the same time\b/.test(t)) return 'parallel_approval';
  if (/\bescalat/.test(t)) return 'escalation';
  if (/\brework\b|\bsend (it )?back\b/.test(t) && /\bapprov/.test(t)) return 'rework';
  if (/\bconditional\b|\bonly when\b|\bif .+ then .+approv/.test(t)) return 'conditional_approval';
  if (/\bsequential\b|\bthen\b.+\bthen\b|\bfirst\b.+\bthen\b/.test(t)) return 'sequential_approval';
  if (/\bapprov|\breview\b/.test(t)) return 'approval';
  if (/\bnotif|\bemail\b|\balert\b/.test(t)) return 'notification';
  if (/\bassign\b/.test(t)) return 'assignment';
  if (/\bsla\b/.test(t)) return 'sla';
  return 'generic';
}

function extractApproverHints(text: string): Array<{ level: number; hint: string }> {
  const out: Array<{ level: number; hint: string }> = [];

  // "Level 1 is Business Owner" / "Level 1 approver is Manager"
  const levelIs = [...text.matchAll(
    /\blevel\s*(\d+)\s+(?:approver\s+)?(?:is|should be|as)\s+([A-Za-z][A-Za-z0-9 /_-]{1,60}?)(?=\s*(?:\.|,|;|and\b|if\b|$))/gi,
  )];
  for (const m of levelIs) {
    out.push({ level: Number(m[1]), hint: m[2].trim() });
  }

  // "Business Owner approves first and Risk Manager approves second"
  const firstSecond = text.match(
    /([A-Za-z][A-Za-z0-9 /_-]{1,40}?)\s+approves?\s+first\s+and\s+([A-Za-z][A-Za-z0-9 /_-]{1,40}?)\s+approves?\s+second/i,
  );
  if (firstSecond) {
    out.push({ level: 1, hint: firstSecond[1].trim() });
    out.push({ level: 2, hint: firstSecond[2].trim() });
  }

  // "Manager should approve first and then Director"
  const thenChain = text.match(
    /([A-Za-z][A-Za-z0-9 /_-]{1,40}?)\s+should\s+approve\s+first\s+and\s+then\s+([A-Za-z][A-Za-z0-9 /_-]{1,40}?)/i,
  );
  if (thenChain) {
    out.push({ level: 1, hint: thenChain[1].trim() });
    out.push({ level: 2, hint: thenChain[2].trim() });
  }

  return out;
}

function extractRejectionHints(text: string): Array<{ fromLevel: number | 'any'; route: RejectionRoute }> {
  const out: Array<{ fromLevel: number | 'any'; route: RejectionRoute }> = [];
  const t = text.toLowerCase();

  if (/if rejected at any stage.+requester|any rejection.+requester|anyone rejects.+requester/i.test(text)) {
    out.push({ fromLevel: 'any', route: { action: 'RETURN_TO_REQUESTER' } });
  }

  // "If Risk Manager rejects, send it back to Business Owner" — needs level mapping later
  const backToLevel = [...text.matchAll(
    /\bif\s+level\s*(\d+)\s+rejects?.{0,40}?(?:return|send).{0,20}?level\s*(\d+)/gi,
  )];
  for (const m of backToLevel) {
    out.push({
      fromLevel: Number(m[1]),
      route: { action: 'RETURN_TO_LEVEL', targetLevel: Number(m[2]) },
    });
  }

  // "If Level 2 rejects … Level 1" / "rejected by Director, send it back to Manager"
  if (/send it back to (?:the )?requester|return to (?:the )?requester/i.test(text)) {
    if (!out.some((o) => o.fromLevel === 'any')) {
      // Level-specific if mentioned
      const l1 = /level\s*1.{0,40}reject.{0,40}requester|business owner rejects?.{0,40}requester/i.test(text);
      const l2 = /level\s*2.{0,40}reject.{0,40}requester/i.test(text);
      if (l1) out.push({ fromLevel: 1, route: { action: 'RETURN_TO_REQUESTER' } });
      if (l2) out.push({ fromLevel: 2, route: { action: 'RETURN_TO_REQUESTER' } });
      if (!l1 && !l2) out.push({ fromLevel: 'any', route: { action: 'RETURN_TO_REQUESTER' } });
    }
  }

  // "If rejected by Level 2 / Risk Manager, send back to Level 1 / Business Owner"
  const sendBack = text.match(
    /if\s+(?:rejected by|level\s*(\d+)\s+rejects?)\s+([A-Za-z][A-Za-z0-9 /_-]{0,40}?)?.{0,30}?(?:send|return).{0,20}?(?:level\s*(\d+)|([A-Za-z][A-Za-z0-9 /_-]{1,40}))/i,
  );
  if (sendBack) {
    const from = sendBack[1] ? Number(sendBack[1]) : 2;
    const toLevel = sendBack[3] ? Number(sendBack[3]) : 1;
    out.push({ fromLevel: from, route: { action: 'RETURN_TO_LEVEL', targetLevel: toLevel } });
  }

  if (/end the workflow|end workflow on reject/i.test(t)) {
    out.push({ fromLevel: 'any', route: { action: 'END_WORKFLOW' } });
  }

  return out;
}

function looksLikeApprovalRequest(text: string): boolean {
  return /\bapprov|\breview workflow|\bmulti[- ]?level|\blevel\s*\d+/i.test(text);
}

function createEmptyAction(actionType: InferredWorkflowActionType): WorkflowActionSpec {
  return {
    actionType,
    valueType: 'static',
    recordCount: 1,
    updateScope: 'all',
    combinationMode: 'single',
    configured: false,
  };
}

/**
 * Analyze a short NL request into a partial AIWorkflowDefinition.
 */
export function analyzeWorkflowIntent(
  prompt: string,
  context?: { formId?: string; formName?: string },
): IntentAnalysisResult {
  const text = String(prompt || '').replace(/\s+/g, ' ').trim();
  const extractedKeys: string[] = [];
  const workflowType = detectWorkflowType(text);
  const isApproval = looksLikeApprovalRequest(text);
  const inferredAction = inferActionTypeFromPrompt(text);

  // Approval path: multi-level Q&A. Generic path: condition + action field Q&A.
  const levelCount = isApproval
    ? (detectLevelCount(text) || 2)
    : 0;
  const parallel = workflowType === 'parallel_approval';

  const levels: WorkflowLevelSpec[] = [];
  for (let i = 1; i <= levelCount; i++) {
    levels.push(createEmptyLevel(i));
  }

  const approverHints = extractApproverHints(text);
  for (const h of approverHints) {
    const level = levels.find((l) => l.level === h.level);
    if (!level) continue;
    level.approver = {
      type: 'unresolved',
      rawHint: h.hint,
      fieldLabel: h.hint,
      resolved: false,
    };
    level.label = `Level ${h.level}: ${h.hint}`;
    extractedKeys.push(`level.${h.level}.approver`);
  }

  const rejectionHints = extractRejectionHints(text);
  // Keep as a soft default hint only — always ask the user where reject should
  // loop (Approver 1 / Approver 2 / requester / end). Do not pre-fill levels.
  const defaultRejection = rejectionHints.find((h) => h.fromLevel === 'any')?.route
    || rejectionHints[0]?.route;
  if (defaultRejection) {
    extractedKeys.push('routing.default_rejection_hint');
  }
  // Level-specific hints from the prompt (e.g. "if Level 2 rejects → Level 1")
  // still pre-fill that level only when explicit.
  for (const h of rejectionHints) {
    if (h.fromLevel === 'any') continue;
    const level = levels.find((l) => l.level === h.fromLevel);
    if (level) {
      level.onRejection = { ...h.route };
      extractedKeys.push(`level.${h.fromLevel}.rejection`);
    }
  }

  // Mark last level next = complete
  if (levels.length) {
    levels[levels.length - 1].onApprovalNext = 'complete';
  }

  const action = isApproval
    ? null
    : createEmptyAction(
      // Approval-ish notify default is wrong for generic — prefer change_field when ambiguous
      inferredAction === 'send_notification' && workflowType === 'generic'
        ? 'change_field_value'
        : inferredAction,
    );

  if (action) {
    extractedKeys.push('action.type');
    // Default create_record target to the trigger form only when prompt
    // does not name another form (e.g. "create a new Incident record").
    if (action.actionType === 'create_record') {
      const formHint = extractCreateTargetFormHint(text);
      if (formHint) {
        action.targetFormName = formHint;
        // id resolved later against forms catalog in the planner
      } else if (context?.formId) {
        action.targetFormId = context.formId;
        action.targetFormName = context.formName;
      }
    }
    if (action.actionType === 'create_combination_records') {
      action.combinationMode = inferCombinationModeFromPrompt(text);
      extractedKeys.push('action.combo_mode');
      const formHint = extractCreateTargetFormHint(text);
      const t = text.toLowerCase();
      // Do NOT treat bare "single" as parent destination — user must pick parent vs
      // cross-ref child (auto-link is only offered when dest is the child XR form).
      const wantsParentDest = /\bon\s+this\s+parent\s+form\b/.test(t)
        || /\bon\s+this\s+form\b/.test(t)
        || /\bon\s+the\s+parent\s+form\b/.test(t)
        || /\bnew\s+record\s+on\s+this\b/.test(t)
        || /\bcreate\s+(?:each\s+)?(?:new\s+)?records?\s+on\s+(?:this\s+)?parent\b/.test(t);
      const wantsChildDest = /\bon\s+(?:the\s+)?(?:cross[- ]?ref|child)\s+form\b/.test(t)
        || /\bcreate\s+(?:each\s+)?(?:new\s+)?records?\s+on\s+(?:the\s+)?(?:cross[- ]?ref|child)\b/.test(t);
      if (formHint) {
        action.targetFormName = formHint;
      } else if (wantsParentDest && !wantsChildDest && context?.formId) {
        action.targetFormId = context.formId;
        action.targetFormName = context.formName;
      }
      // Child dest is resolved in the planner after the XR field is known
    }
  }

  const nameBits = [
    context?.formName,
    isApproval && levelCount > 1 ? `${levelCount}-Level` : undefined,
    isApproval ? 'Approval' : 'Workflow',
  ].filter(Boolean);

  const definition = createEmptyWorkflowDefinition({
    name: nameBits.join(' ') || 'AI Workflow',
    description: text.slice(0, 240),
    objectId: context?.formId,
    objectName: context?.formName,
    workflowType: isApproval
      ? (workflowType === 'generic' ? 'approval' : workflowType)
      : (workflowType === 'approval' ? 'generic' : workflowType),
    trigger: {
      kind: 'form_submission',
      formId: context?.formId,
      formName: context?.formName,
    },
    levels,
    action,
    parallel,
    defaultRejection: defaultRejection,
  });

  // Always conversational for AI Suggest workflows (approval or generic action)
  const needsConversation = true;

  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (isApproval) {
    if (approverHints.length >= levelCount && rejectionHints.length > 0) confidence = 'high';
    else if (approverHints.length > 0 || levelCount >= 2) confidence = 'medium';
  } else if (action) {
    confidence = action.actionType !== 'change_field_value' ? 'medium' : 'low';
  }

  return { definition, extractedKeys, confidence, needsConversation };
}

/** True when the prompt should enter the conversational builder instead of blind create. */
export function shouldUseConversationalWorkflowBuilder(prompt: string): boolean {
  const t = String(prompt || '').toLowerCase().trim();
  if (!t) return false;
  // Explicit approval / multi-level language (short goals welcome)
  if (/\b(\d+|two|three|four|five|six|seven|eight)\s*[- ]?\s*levels?\b/.test(t)) return true;
  if (/\bmulti[- ]?level\b/.test(t) && /\bapprov|review|workflow\b/.test(t)) return true;
  if (/\b(sequential|parallel)\s+approv/.test(t)) return true;
  if (/\bapprov/.test(t) && /\b(workflow|manager|director|level|review)\b/.test(t)) return true;
  if (/\bcreate\b.+\bapprov|\bapprov.+\bworkflow\b/.test(t)) return true;
  if (/\blevel\s*1\b.+\blevel\s*2\b/.test(t)) return true;
  if (/\bmanager\b.+\bdirector\b.+\bapprov|\bapprov.+\bmanager\b.+\bdirector\b/.test(t)) return true;
  // Generic action-style workflow language
  if (/\b(change|set|update)\b.+\bfield\b/.test(t)) return true;
  if (/\b(change|set|update)\b.+\bto\b/.test(t)) return true;
  if (/\bwhen\b.+\b(set|change|update|create)\b/.test(t)) return true;
  if (/\bif\b.+\bthen\b.+\b(set|change|update|create)\b/.test(t)) return true;
  if (/\bcreate\s+(?:a\s+)?(?:new\s+)?(?:linked\s+)?record\b/.test(t)) return true;
  if (/\bcreate\s+(?:an?\s+)?(?:new\s+)?[\w][\w\s/-]{0,40}?\s+records?\b/.test(t)) return true;
  if (/\bcreate\s+(?:an?\s+)?(?:new\s+)?[\w][\w\s/-]{0,40}?\s+(?:ticket|submission|entry)\b/.test(t)) return true;
  if (/\bcreate\s+(?:an?\s+)?new\s+[\w][\w/-]+\b/.test(t)) return true;
  if (/\bupdate\s+linked\b|\blinked\s+record\b|\bcross[- ]?ref/.test(t)) return true;
  if (/\bcombin(?:e|ation)\b/.test(t)) return true;
  if (/\bworkflow\b/.test(t) && /\b(if|when|then|create|update|set|change|approv)\b/.test(t)) return true;
  // Very short workflow-ish goals
  if (t.split(/\s+/).length <= 12 && /\b(approv|workflow|escalat|notif)/.test(t)) return true;
  return false;
}

export { describeActionType, inferActionTypeFromPrompt };
