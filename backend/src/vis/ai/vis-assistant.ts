import type { IAIProvider, IAssistant } from '../core/ai/index';
import type { IntegrationDesign, FieldMappingSpec, DiscoveredField } from '../core/types/index';
import { validateIntegrationDesign } from '../core/schemas/integrationDesign';

/** Deterministic mock LLM — no external API required for MVP. */
export class MockAIProvider implements IAIProvider {
  async generate(prompt: string): Promise<string> {
    return `Mock analysis of: ${prompt.slice(0, 120)}`;
  }

  async analyze(prompt: string): Promise<unknown> {
    return this.buildDesign(prompt);
  }

  async structuredOutput<T>(prompt: string): Promise<T> {
    return this.buildDesign(prompt) as T;
  }

  buildDesign(prompt: string): IntegrationDesign {
    const p = prompt.toLowerCase();
    const every15 = /15\s*min|every\s*15|quarter.?hour/.test(p);
    const scheduled = /every|schedule|cron|hourly|daily|minute/.test(p) || every15;
    const upsert = /create\s+or\s+update|upsert|sync/.test(p);
    const servicenow = /servicenow|snow\b/.test(p);
    const vuln = /vulnerabilit/.test(p);
    const internal = /internal|form|topsqill|our\s+app/.test(p);

    const design: IntegrationDesign = {
      name: vuln ? 'ServiceNow Vulnerabilities → Internal Form' : 'Prompt Integration',
      summary: prompt.trim().slice(0, 500) || 'Integration from natural-language requirement',
      source: 'REST_API',
      target: internal || vuln ? 'INTERNAL_APPLICATION_API' : 'REST_API',
      direction: /bidirectional|two.?way|↔/.test(p) ? 'BIDIRECTIONAL' : 'UNIDIRECTIONAL',
      executionMode: scheduled ? 'SCHEDULED' : /webhook|event/.test(p) ? 'EVENT_DRIVEN' : 'MANUAL',
      frequency: every15 ? '15_MINUTES' : scheduled ? 'HOURLY' : null,
      scheduleKind: every15 ? 'INTERVAL' : scheduled ? 'HOURLY' : 'MANUAL',
      operations: upsert
        ? ['READ', 'CREATE', 'UPDATE', 'UPSERT']
        : /delete/.test(p)
          ? ['READ', 'DELETE']
          : ['READ', 'CREATE'],
      language: 'PYTHON',
      languageReason:
        'REST API and data-transformation workload with moderate throughput; Python has strong HTTP/JSON ergonomics and mature connector patterns.',
      workers: 5,
      batchSize: 500,
      concurrency: 5,
      retryPolicy: 'EXPONENTIAL',
      rateLimitPerMinute: 120,
      idempotencyStrategy: 'EXTERNAL_ID',
      authHint: 'OAUTH2',
      sourceHints: {
        vendorExample: servicenow ? 'ServiceNow (generic REST)' : 'Generic REST',
        openFilter: /open/.test(p) ? 'status=Open' : null,
      },
      targetHints: {
        formHint: vuln ? 'Vulnerability' : 'Selected internal form',
      },
      suggestedMappings: vuln
        ? [
            { sourceField: 'id', targetField: 'vulnerability_id', confidence: 'HIGH' },
            {
              sourceField: 'severity',
              targetField: 'priority',
              confidence: 'HIGH',
              transformation: 'Critical→1;High→2;Medium→3;Low→4',
            },
            { sourceField: 'description', targetField: 'description', confidence: 'HIGH' },
            { sourceField: 'team', targetField: 'assignment_group', confidence: 'MEDIUM' },
            { sourceField: 'status', targetField: 'status', confidence: 'HIGH' },
            { sourceField: 'id', targetField: 'external_id', confidence: 'HIGH' },
          ]
        : [],
    };
    return validateIntegrationDesign(design) as IntegrationDesign;
  }
}

export class VisAssistant implements IAssistant {
  constructor(private readonly provider: IAIProvider = new MockAIProvider()) {}

  async analyzeRequirement(naturalLanguage: string): Promise<IntegrationDesign> {
    const raw = await this.provider.structuredOutput<IntegrationDesign>(naturalLanguage, 'IntegrationDesign');
    return validateIntegrationDesign(raw) as IntegrationDesign;
  }

  async recommendArchitecture(design: IntegrationDesign): Promise<IntegrationDesign> {
    return validateIntegrationDesign({
      ...design,
      workers: design.workers || 5,
      batchSize: design.batchSize || 500,
      retryPolicy: design.retryPolicy || 'EXPONENTIAL',
    }) as IntegrationDesign;
  }

  async recommendLanguage(design: IntegrationDesign) {
    // Simple heuristic — extensible later
    let language = design.language || 'PYTHON';
    let reason = design.languageReason;
    if (design.target === 'DATABASE' || design.source === 'DATABASE') {
      language = 'JAVA';
      reason = 'Database-heavy integrations often benefit from JDBC ecosystems and strong typing.';
    } else if ((design.concurrency || 0) > 50 || (design.workers || 0) > 20) {
      language = 'GO';
      reason = 'High concurrency / worker fan-out favors Go for efficient goroutine-based I/O.';
    } else if (design.source === 'REST_API' && design.target === 'INTERNAL_APPLICATION_API') {
      language = 'PYTHON';
      reason =
        'REST API and data-transformation workload with moderate throughput.';
    }
    return { language: language as IntegrationDesign['language'], reason };
  }

  async suggestMappings(input: {
    sourceFields: Array<{ name: string; label?: string; type?: string }>;
    targetFields: DiscoveredField[];
    design?: IntegrationDesign;
  }): Promise<FieldMappingSpec[]> {
    if (input.design?.suggestedMappings?.length) {
      return input.design.suggestedMappings.map((m, i) => ({
        id: `map_${i}`,
        sourceField: m.sourceField,
        targetField: m.targetField,
        confidence: m.confidence,
        transformation: m.transformation,
        enabled: m.confidence !== 'LOW',
        required: false,
      }));
    }
    const out: FieldMappingSpec[] = [];
    for (const src of input.sourceFields) {
      const norm = src.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const target = input.targetFields.find((t) => {
        const tn = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return tn === norm || tn.includes(norm) || norm.includes(tn);
      });
      if (target) {
        out.push({
          id: `map_${out.length}`,
          sourceField: src.name,
          targetField: target.name,
          confidence: target.name.toLowerCase() === src.name.toLowerCase() ? 'HIGH' : 'MEDIUM',
          enabled: true,
        });
      }
    }
    return out;
  }

  async suggestTransformations(mappings: FieldMappingSpec[]): Promise<FieldMappingSpec[]> {
    return mappings.map((m) => {
      if (m.sourceField.toLowerCase() === 'severity' && m.targetField.toLowerCase() === 'priority') {
        return {
          ...m,
          transformation: m.transformation || 'Critical→1;High→2;Medium→3;Low→4',
        };
      }
      return m;
    });
  }

  async validateIntegration(design: IntegrationDesign) {
    const issues: Array<{ severity: 'error' | 'warning'; code: string; message: string }> = [];
    try {
      validateIntegrationDesign(design);
    } catch (e: any) {
      issues.push({ severity: 'error', code: 'SCHEMA', message: String(e?.message || e) });
    }
    if (!design.operations.length) {
      issues.push({ severity: 'error', code: 'OPS', message: 'At least one operation is required' });
    }
    if (design.executionMode === 'SCHEDULED' && !design.frequency && !design.scheduleKind) {
      issues.push({ severity: 'warning', code: 'SCHEDULE', message: 'Scheduled mode without frequency' });
    }
    return { ok: issues.filter((i) => i.severity === 'error').length === 0, issues };
  }

  async reviewIntegration(design: IntegrationDesign) {
    return {
      summary: `${design.direction} ${design.source} → ${design.target} (${design.executionMode}) using ${design.language}`,
      recommendations: [
        'Confirm authentication and credential references before activation.',
        'Review LOW-confidence mappings before production.',
        'Validate SSRF / allowlist policy for source and target URLs.',
        'Do not activate until DRAFT → VALIDATED → APPROVED.',
      ],
    };
  }
}
