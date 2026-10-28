import {
  chatCompletions,
  resolveAiGatewayConfig,
  type EnvGetter,
} from '../engines/shared/ai-gateway';
import { diffSourceKeys } from './record-rules';
import { explicitShallSentences } from './text-utils';

const DISCLAIMER = 'This is a draft explanation of the stored record. It is not legal advice and it is not the authoritative source text.';

export interface RegulatoryAiResult {
  available: boolean;
  action: string;
  disclaimer: string;
  result?: unknown;
  reason?: string;
}

function recordText(record: Record<string, unknown> | undefined): string {
  if (!record) return '';
  return String(record.authoritative_text || record.requirement_statement || record.legal_status || record.text || '');
}

export function extractClauseCandidates(text: string) {
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const structures: Array<{ identifier: string; title: string; kind: string }> = [];
  for (const line of lines) {
    const article = line.match(/^Article\s+(\d+)\b[:\s-]*(.*)$/i);
    const section = line.match(/^Section\s+(\d+)\b[:\s-]*(.*)$/i);
    const chapter = line.match(/^Chapter\s+([IVXLC0-9]+)\b[:\s-]*(.*)$/i);
    if (article) structures.push({ identifier: `Article ${article[1]}`, title: article[2] || '', kind: 'article' });
    else if (section) structures.push({ identifier: `Section ${section[1]}`, title: section[2] || '', kind: 'section' });
    else if (chapter) structures.push({ identifier: `Chapter ${chapter[1]}`, title: chapter[2] || '', kind: 'chapter' });
  }
  return {
    structures,
    obligations: explicitShallSentences(text).map((sentence) => ({
      statement: sentence,
      status: 'draft',
      note: 'Identifier was not invented. Attach this sentence only to a clause the parser already identified.',
    })),
    failures: structures.length === 0 ? ['No Article, Section, or Chapter heading was found in the supplied text.'] : [],
  };
}

export async function runRegulatoryAiAction(
  action: string,
  context: Record<string, unknown>,
  getEnv: EnvGetter,
): Promise<RegulatoryAiResult> {
  if (context.submissionId && !context.record) {
    return {
      available: false,
      action,
      disclaimer: DISCLAIMER,
      reason: 'This action does not load records with a service credential. Call the regulatory API, which reads records with the user token.',
    };
  }

  if (action === 'regulatory-clause-extract') {
    return {
      available: true,
      action,
      disclaimer: DISCLAIMER,
      result: extractClauseCandidates(String(context.text || '')),
    };
  }

  if (action === 'regulatory-quality-check') {
    return {
      available: true,
      action,
      disclaimer: DISCLAIMER,
      result: {
        findings: Array.isArray(context.findings) ? context.findings : [],
        note: 'Findings are deterministic. Approved records are not modified.',
      },
    };
  }

  if (action === 'regulatory-change-analysis') {
    const left = Array.isArray(context.leftKeys) ? context.leftKeys.map(String) : [];
    const right = Array.isArray(context.rightKeys) ? context.rightKeys.map(String) : [];
    if (!left.length || !right.length) {
      return {
        available: false,
        action,
        disclaimer: DISCLAIMER,
        reason: 'Two verified source versions are required. A change is not invented from a single snapshot.',
      };
    }
    return {
      available: true,
      action,
      disclaimer: DISCLAIMER,
      result: {
        ...diffSourceKeys(left, right),
        affectedRequirements: 'Review requirements whose primary clause key is in added or removed. Do not close them automatically.',
      },
    };
  }

  if (action === 'regulatory-evidence-suggestions') {
    const policies = Array.isArray(context.policies) ? context.policies : [];
    const statement = String(context.statement || '').toLowerCase();
    const matched = policies.filter((policy) => {
      const row = policy as { name?: string; reference?: string };
      const haystack = `${row.name || ''} ${row.reference || ''}`.toLowerCase();
      return statement && haystack.split(/\W+/).some((word) => word.length > 4 && statement.includes(word));
    });
    return {
      available: true,
      action,
      disclaimer: DISCLAIMER,
      result: {
        policies: matched,
        controls: [],
        controlNote: 'No operational control form is registered, so no control record is linked.',
        evidence: 'A suggested evidence type is not proof of compliance.',
      },
    };
  }

  if (action === 'regulatory-applicability') {
    const orgContext = String(context.organizationContext || '').trim();
    return {
      available: true,
      action,
      disclaimer: DISCLAIMER,
      result: {
        suggestions: orgContext
          ? ['Compare the organization description with each standard jurisdiction. Do not mark a standard applicable only because it is in the catalog.']
          : [],
        questions: [
          'Which jurisdictions does the organization operate in?',
          'Does it offer goods or services to people in the European Union or India?',
          'Which business processes handle personal data?',
        ],
        missing: orgContext ? [] : ['No organization context was supplied, so applicability cannot be suggested.'],
        decision: 'Not decided',
      },
    };
  }

  const generative = new Set([
    'regulatory-requirement-draft',
    'regulatory-plain-language',
  ]);
  if (!generative.has(action)) {
    return { available: false, action, disclaimer: DISCLAIMER, reason: `Unknown regulatory action ${action}` };
  }

  const source = recordText(context.record as Record<string, unknown> | undefined) || String(context.text || '');
  if (!source.trim()) {
    return { available: false, action, disclaimer: DISCLAIMER, reason: 'No source text was supplied.' };
  }

  let gateway;
  try {
    gateway = resolveAiGatewayConfig(getEnv);
  } catch (error) {
    return {
      available: false,
      action,
      disclaimer: DISCLAIMER,
      reason: error instanceof Error ? error.message : 'AI gateway is not configured.',
    };
  }

  const completion = await chatCompletions(gateway, {
    messages: [
      {
        role: 'system',
        content: `${DISCLAIMER} Use only the supplied source text. Do not invent article numbers, dates, or obligations that are not in the text. Return JSON with keys explanation, qualifications, and reviewFlags.`,
      },
      { role: 'user', content: source.slice(0, 12000) },
    ],
    temperature: 0.1,
    max_tokens: 800,
  });
  if (!completion.ok) {
    const failure = completion as { error?: string };
    return { available: false, action, disclaimer: DISCLAIMER, reason: failure.error || 'AI request failed.' };
  }
  return {
    available: true,
    action,
    disclaimer: DISCLAIMER,
    result: {
      draft: completion.data.choices?.[0]?.message?.content || '',
      stored: false,
      reviewStatus: 'Awaiting review',
    },
  };
}
