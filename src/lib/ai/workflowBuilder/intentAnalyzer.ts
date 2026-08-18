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
  type WorkflowLevelSpec,
} from './types';

export interface IntentAnalysisResult {
  definition: AIWorkflowDefinition;
  /** Hints already extracted (so planner won't re-ask) */
  extractedKeys: string[];
  confidence: 'high' | 'medium' | 'low';
  needsConversation: boolean;
}

function detectLevelCount(text: string): number | null {
  const m = text.match(/\b(\d+)\s*[- ]?\s*levels?\b/i)
    || text.match(/\b(two|three|four|five|one)\s*[- ]?\s*levels?\b/i)
    || text.match(/\b(2|3|4|5)\s*level\b/i);
  if (!m) {
    // "Level 1 and Level 2" style
    const levels = [...text.matchAll(/\blevel\s*(\d+)\b/gi)].map((x) => Number(x[1]));
    if (levels.length) return Math.max(...levels);
    return null;
  }
  const raw = m[1].toLowerCase();
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  return words[raw] || Number(raw) || null;
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
  const levelCount = detectLevelCount(text) || (looksLikeApprovalRequest(text) ? 2 : 1);
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
  for (const h of rejectionHints) {
    if (h.fromLevel === 'any') {
      for (const level of levels) {
        if (!level.onRejection) level.onRejection = { ...h.route };
      }
      extractedKeys.push('routing.default_rejection');
    } else {
      const level = levels.find((l) => l.level === h.fromLevel);
      if (level) {
        level.onRejection = { ...h.route };
        extractedKeys.push(`level.${h.fromLevel}.rejection`);
      }
    }
  }

  // Mark last level next = complete
  if (levels.length) {
    levels[levels.length - 1].onApprovalNext = 'complete';
  }

  const nameBits = [
    context?.formName,
    levelCount > 1 ? `${levelCount}-Level` : undefined,
    /approv/i.test(text) ? 'Approval' : 'Workflow',
  ].filter(Boolean);

  const definition = createEmptyWorkflowDefinition({
    name: nameBits.join(' ') || 'AI Workflow',
    description: text.slice(0, 240),
    objectId: context?.formId,
    objectName: context?.formName,
    workflowType,
    trigger: {
      kind: 'form_submission',
      formId: context?.formId,
      formName: context?.formName,
    },
    levels,
    parallel,
    defaultRejection: rejectionHints.find((h) => h.fromLevel === 'any')?.route,
  });

  const needsConversation = looksLikeApprovalRequest(text)
    || workflowType.includes('approval')
    || levelCount >= 2;

  // Confidence: high if approvers + rejections extracted; medium if only levels; low otherwise
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (approverHints.length >= levelCount && rejectionHints.length > 0) confidence = 'high';
  else if (approverHints.length > 0 || levelCount >= 2) confidence = 'medium';

  return { definition, extractedKeys, confidence, needsConversation };
}

/** True when the prompt should enter the conversational approval builder instead of blind create. */
export function shouldUseConversationalWorkflowBuilder(prompt: string): boolean {
  const t = String(prompt || '').toLowerCase();
  if (!t.trim()) return false;
  // Explicit approval / multi-level language
  if (/\b(\d+|two|three|four|five)\s*[- ]?\s*levels?\b/.test(t) && /\bapprov|review|workflow\b/.test(t)) {
    return true;
  }
  if (/\bmulti[- ]?level\b.*\bapprov|\bapprov.*\bmulti[- ]?level\b/.test(t)) return true;
  if (/\b(sequential|parallel)\s+approv/.test(t)) return true;
  if (/\bcreate\b.+\bapprov.+\bworkflow\b|\bapprov.+\bworkflow\b/.test(t)) return true;
  if (/\blevel\s*1\b.+\blevel\s*2\b/.test(t) && /\bapprov/.test(t)) return true;
  return false;
}
