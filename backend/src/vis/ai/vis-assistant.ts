import type { IAIProvider, IAssistant } from '../core/ai/index';
import type {
  ClarificationAnswers,
  ClarificationQuestion,
  ClarificationResult,
  DesignValidationReport,
  DiscoveredField,
  DryRunResult,
  FieldMappingSpec,
  IntegrationDesign,
} from '../core/types/index';
import { validateIntegrationDesign } from '../core/schemas/integrationDesign';
import {
  aiProposalToIntegrationDesign,
  validateAiDesignProposal,
  type AiDesignProposal,
} from '../core/schemas/aiDesignProposal';
import {
  applyNaturalLanguageMappingEdit,
  applyTransformSuggestions,
  defaultMatchingStrategy,
  runDryRun,
  suggestFieldMappings,
  validateMappings,
} from '../core/mapping/index';

/** Deterministic mock LLM — no external API required for MVP. */
export class MockAIProvider implements IAIProvider {
  async generate(prompt: string): Promise<string> {
    return `Mock analysis of: ${prompt.slice(0, 120)}`;
  }

  async analyze(prompt: string): Promise<unknown> {
    return this.buildProposal(prompt);
  }

  async structuredOutput<T>(prompt: string): Promise<T> {
    return this.buildProposal(prompt) as T;
  }

  /** Structured AI proposal (validated separately). */
  buildProposal(prompt: string, answers?: ClarificationAnswers): AiDesignProposal {
    const p = `${prompt} ${Object.values(answers || {}).join(' ')}`.toLowerCase();
    const every15 =
      /15\s*min|every\s*15|quarter.?hour/.test(p)
      || answers?.frequency === '15_MINUTES'
      || answers?.q_frequency === '15_MINUTES';
    const every5 = /5\s*min|every\s*5/.test(p) || answers?.frequency === '5_MINUTES';
    const hourly = /hourly|every\s*hour/.test(p) || answers?.frequency === 'HOURLY';
    const daily = /daily|every\s*day/.test(p) || answers?.frequency === 'DAILY';
    const realtime = /real.?time|webhook|event|immediately|whenever|when\s+a\s+\w+\s+is\s+created|when\s+a\s+\w+\s+is\s+updated/.test(p)
      || answers?.frequency === 'REALTIME'
      || answers?.executionMode === 'REAL_TIME';
    const scheduled = every15 || every5 || hourly || daily || /every|schedule|cron|minute/.test(p);
    const upsert = /create\s+or\s+update|upsert|sync/.test(p);
    const servicenow =
      /servicenow|snow\b/.test(p)
      || answers?.source === 'ServiceNow'
      || answers?.q_source === 'ServiceNow';
    const database = /database|sql|jdbc/.test(p) || answers?.source === 'Database' || answers?.q_source === 'Database';
    const crowdstrike = /crowdstrike|falcon|edr|device|host\b|endpoint|mockoon/.test(p);
    const vuln = /vulnerabilit/.test(p) && !crowdstrike;
    const internal = /internal|form|topsqill|our\s+app/.test(p);
    const envSync = /dev.*uat|uat.*dev|environment/.test(p) && !crowdstrike;

    let schedule: AiDesignProposal['schedule'] | undefined;
    let executionMode: AiDesignProposal['executionMode'] = 'MANUAL';
    if (realtime && !scheduled) {
      executionMode = 'REAL_TIME';
      schedule = { type: 'MANUAL', value: null, unit: null };
    } else if (every15) {
      executionMode = 'SCHEDULED';
      schedule = { type: 'INTERVAL', value: 15, unit: 'MINUTES' };
    } else if (every5) {
      executionMode = 'SCHEDULED';
      schedule = { type: 'INTERVAL', value: 5, unit: 'MINUTES' };
    } else if (hourly) {
      executionMode = 'SCHEDULED';
      schedule = { type: 'HOURLY', value: 1, unit: 'HOURS' };
    } else if (daily) {
      executionMode = 'SCHEDULED';
      schedule = { type: 'DAILY', value: 1, unit: 'DAYS' };
    } else if (scheduled) {
      executionMode = 'SCHEDULED';
      schedule = { type: 'HOURLY', value: 1, unit: 'HOURS' };
    }

    const sourceType = database ? 'DATABASE' : 'REST_API';
    const sourceSystem = crowdstrike
      ? 'CrowdStrike'
      : servicenow
        ? 'ServiceNow'
        : database
          ? 'Database'
          : answers?.source || answers?.q_source || 'Generic REST';

    const proposal: AiDesignProposal = {
      name: crowdstrike
        ? 'CrowdStrike Devices → Internal Form'
        : envSync
          ? 'DEV → UAT Vulnerability Real-Time Sync'
          : vuln
            ? 'ServiceNow Vulnerabilities → Internal Form'
            : 'Prompt Integration',
      summary: prompt.trim().slice(0, 500) || 'Integration from natural-language requirement',
      source: { type: sourceType, system: String(sourceSystem) },
      target: {
        type: internal || vuln || envSync || crowdstrike ? 'INTERNAL_APPLICATION_API' : 'REST_API',
        // CrowdStrike uses the form selected in Discover Forms — not Vulnerability
        formName: crowdstrike ? undefined : vuln || envSync ? 'Vulnerability' : undefined,
      },
      direction: /bidirectional|two.?way|↔/.test(p) ? 'BIDIRECTIONAL' : 'UNIDIRECTIONAL',
      executionMode,
      schedule,
      operations: upsert
        ? ['READ', 'CREATE', 'UPDATE', 'UPSERT']
        : /delete/.test(p)
          ? ['READ', 'DELETE']
          : ['READ', 'CREATE'],
      language: 'PYTHON',
      languageReason:
        'The workload is primarily REST API communication and data transformation with moderate throughput.',
      workers: 5,
      batchSize: 500,
      concurrency: 5,
      retryPolicy: 'EXPONENTIAL',
      rateLimitPerMinute: 120,
      idempotencyStrategy: 'EXTERNAL_ID',
      authHint: crowdstrike ? 'API_KEY' : database ? 'DATABASE' : 'OAUTH2',
      // CrowdStrike: wait for Discover Schema to score against real form fields
      suggestedMappings: crowdstrike
        ? []
        : vuln
          ? [
            {
              sourceField: 'id',
              targetField: 'vulnerability_id',
              confidence: 'HIGH',
              reason: 'Exact identifier correspondence.',
            },
            {
              sourceField: 'severity',
              targetField: 'priority',
              confidence: 'HIGH',
              transformation: 'Critical→1;High→2;Medium→3;Low→4',
              reason:
                'Both fields represent vulnerability severity. The target uses a numeric priority, so a value transformation is required.',
            },
            {
              sourceField: 'description',
              targetField: 'description',
              confidence: 'HIGH',
              reason: 'Exact field name match.',
            },
            {
              sourceField: 'team',
              targetField: 'assignment_group',
              confidence: 'MEDIUM',
              reason: 'Team maps to assignment group via reference lookup.',
            },
            {
              sourceField: 'status',
              targetField: 'status',
              confidence: 'HIGH',
              reason: 'Exact field name match.',
            },
            {
              sourceField: 'id',
              targetField: 'external_id',
              confidence: 'HIGH',
              reason: 'Use source id as idempotency / matching key.',
            },
          ]
        : [],
    };

    return validateAiDesignProposal(proposal);
  }

  /** Legacy helper — returns IntegrationDesign. */
  buildDesign(prompt: string, answers?: ClarificationAnswers): IntegrationDesign {
    const proposal = this.buildProposal(prompt, answers);
    return aiProposalToIntegrationDesign(proposal, prompt);
  }

  detectClarifications(prompt: string): ClarificationQuestion[] {
    const p = prompt.toLowerCase().trim();
    const questions: ClarificationQuestion[] = [];

    const hasSource =
      /servicenow|snow\b|rest\s*api|database|sql|jdbc|jira|salesforce|oracle|splunk|\bdev\b|\buat\b|\bprod\b|environment/.test(p)
      || /\bfrom\s+[a-z0-9_\- ]+/.test(p);
    const hasFrequency =
      /every|schedule|cron|hourly|daily|minute|real.?time|webhook|on\s+demand|manual|immediately|whenever|when\s+a\s+\w+\s+is\s+(created|updated|deleted)/.test(p);
    const mentionsSync = /sync|integrat|pull|push|get|create|update|map|whenever|when\s+a/.test(p);

    if (mentionsSync && !hasSource) {
      questions.push({
        id: 'q_source',
        field: 'source',
        prompt: 'What is the source system?',
        options: [
          { value: 'ServiceNow', label: 'ServiceNow' },
          { value: 'REST API', label: 'REST API' },
          { value: 'Database', label: 'Database' },
          { value: 'Other', label: 'Other' },
        ],
        allowCustom: true,
      });
    }

    if (mentionsSync && !hasFrequency) {
      questions.push({
        id: 'q_frequency',
        field: 'frequency',
        prompt: 'How frequently should synchronization run?',
        options: [
          { value: 'REALTIME', label: 'Real-time' },
          { value: '5_MINUTES', label: 'Every 5 minutes' },
          { value: '15_MINUTES', label: 'Every 15 minutes' },
          { value: 'HOURLY', label: 'Hourly' },
          { value: 'DAILY', label: 'Daily' },
          { value: 'CUSTOM', label: 'Custom' },
        ],
        allowCustom: true,
      });
    }

    return questions;
  }
}

export class VisAssistant implements IAssistant {
  constructor(private readonly provider: IAIProvider = new MockAIProvider()) {}

  async clarifyRequirement(
    naturalLanguage: string,
  ): Promise<ClarificationResult | { needsClarification: false }> {
    const mock = this.provider instanceof MockAIProvider ? this.provider : new MockAIProvider();
    const questions = mock.detectClarifications(naturalLanguage);
    if (!questions.length) return { needsClarification: false };
    return { needsClarification: true, questions };
  }

  async analyzeWithClarifications(
    naturalLanguage: string,
    answers: ClarificationAnswers,
  ): Promise<IntegrationDesign> {
    if (this.provider instanceof MockAIProvider) {
      const proposal = this.provider.buildProposal(naturalLanguage, answers);
      return aiProposalToIntegrationDesign(proposal, naturalLanguage);
    }
    const raw = await this.provider.structuredOutput<unknown>(
      `${naturalLanguage}\nAnswers:${JSON.stringify(answers)}`,
      'AiDesignProposal',
    );
    const proposal = validateAiDesignProposal(raw);
    return aiProposalToIntegrationDesign(proposal, naturalLanguage);
  }

  async analyzeRequirement(naturalLanguage: string): Promise<IntegrationDesign> {
    // Prefer structured AI proposal → IntegrationDesign
    try {
      if (this.provider instanceof MockAIProvider) {
        const proposal = this.provider.buildProposal(naturalLanguage);
        return aiProposalToIntegrationDesign(proposal, naturalLanguage);
      }
      const raw = await this.provider.structuredOutput<unknown>(
        naturalLanguage,
        'AiDesignProposal',
      );
      const proposal = validateAiDesignProposal(raw);
      return aiProposalToIntegrationDesign(proposal, naturalLanguage);
    } catch (e: any) {
      // Do not save invalid AI output — surface as error to caller
      throw new Error(
        `AI returned invalid configuration: ${e?.message || e}. Please regenerate.`,
      );
    }
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
        'The workload is primarily REST API communication and data transformation with moderate throughput.';
    }
    return { language: language as IntegrationDesign['language'], reason };
  }

  async suggestMappings(input: {
    sourceFields: Array<{ name: string; label?: string; type?: string }>;
    targetFields: DiscoveredField[];
    design?: IntegrationDesign;
  }): Promise<FieldMappingSpec[]> {
    const crowdstrike =
      (input.design as any)?.sourceHints?.system === 'CrowdStrike'
      || /crowdstrike|falcon|mockoon|device/i.test(String(input.design?.name || ''));

    // Without a discovered form schema, never invent Vulnerability targets for CrowdStrike
    if (input.design?.suggestedMappings?.length && input.targetFields.length === 0) {
      if (crowdstrike) return [];
      return input.design.suggestedMappings.map((m, i) => ({
        id: `map_${i}`,
        sourceField: m.sourceField,
        targetField: m.targetField,
        confidence: m.confidence,
        confidencePercent:
          m.confidence === 'HIGH' ? 95 : m.confidence === 'MEDIUM' ? 78 : 45,
        transformation: m.transformation,
        reason: m.reason || null,
        enabled: m.confidence !== 'LOW',
        required: false,
      }));
    }

    // Prefer engine scoring when target schema is known
    if (input.targetFields.length > 0) {
      let mappings = suggestFieldMappings({
        sourceFields: input.sourceFields,
        targetFields: input.targetFields,
      });
      // Merge design suggestions only when both sides exist on this form
      if (input.design?.suggestedMappings?.length) {
        for (const suggested of input.design.suggestedMappings) {
          const idx = mappings.findIndex(
            (m) =>
              m.sourceField === suggested.sourceField
              && m.targetField === suggested.targetField,
          );
          if (idx >= 0) {
            mappings[idx] = {
              ...mappings[idx],
              confidence: suggested.confidence,
              transformation: suggested.transformation || mappings[idx].transformation,
              reason: suggested.reason || mappings[idx].reason,
            };
          } else if (
            input.targetFields.some((t) => t.name === suggested.targetField)
            && input.sourceFields.some((s) => s.name === suggested.sourceField)
          ) {
            mappings.push({
              id: `map_${mappings.length}`,
              sourceField: suggested.sourceField,
              targetField: suggested.targetField,
              confidence: suggested.confidence,
              confidencePercent:
                suggested.confidence === 'HIGH' ? 95 : suggested.confidence === 'MEDIUM' ? 81 : 45,
              transformation: suggested.transformation,
              reason: suggested.reason || null,
              enabled: suggested.confidence !== 'LOW',
            });
          }
        }
      }
      return applyTransformSuggestions(mappings, input.targetFields);
    }

    return suggestFieldMappings({
      sourceFields: input.sourceFields,
      targetFields: input.targetFields,
    });
  }

  async suggestTransformations(mappings: FieldMappingSpec[]): Promise<FieldMappingSpec[]> {
    return applyTransformSuggestions(mappings);
  }

  async applyNaturalLanguageMappingChange(
    mappings: FieldMappingSpec[],
    instruction: string,
    context?: {
      sourceFields?: Array<{ name: string }>;
      targetFields?: DiscoveredField[];
    },
  ): Promise<FieldMappingSpec[]> {
    return applyNaturalLanguageMappingEdit(mappings, instruction, context);
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

  async validateDesignComplete(input: {
    design: IntegrationDesign;
    mappings: FieldMappingSpec[];
    sourceFields: Array<{ name: string }>;
    targetFields: DiscoveredField[];
    hasSourceConnection?: boolean;
    hasTargetConnection?: boolean;
    hasMatchingStrategy?: boolean;
  }): Promise<DesignValidationReport> {
    const issues: DesignValidationReport['issues'] = [];

    const designCheck = await this.validateIntegration(input.design);
    for (const i of designCheck.issues) {
      issues.push({
        severity: i.severity === 'error' ? 'ERROR' : 'WARNING',
        code: i.code,
        message: i.message,
      });
    }

    if (input.hasSourceConnection) {
      issues.push({ severity: 'PASS', code: 'SOURCE_CONN', message: 'Source connection configured.' });
    } else {
      issues.push({
        severity: 'WARNING',
        code: 'SOURCE_CONN',
        message: 'Source connection is not configured yet.',
      });
    }

    if (input.hasTargetConnection) {
      issues.push({
        severity: 'PASS',
        code: 'TARGET_CONN',
        message: 'Target connection configured.',
      });
    } else {
      issues.push({
        severity: 'WARNING',
        code: 'TARGET_CONN',
        message: 'Target / Internal Application connection is not configured yet.',
      });
    }

    if (input.targetFields.length > 0) {
      issues.push({
        severity: 'PASS',
        code: 'TARGET_SCHEMA',
        message: 'Target form schema discovered.',
      });
    } else {
      issues.push({
        severity: 'WARNING',
        code: 'TARGET_SCHEMA',
        message: 'Target schema is not available yet — discover the form schema to harden validation.',
      });
    }

    if (input.sourceFields.length > 0) {
      issues.push({
        severity: 'PASS',
        code: 'SOURCE_SCHEMA',
        message: 'Source fields available.',
      });
    } else {
      issues.push({
        severity: 'WARNING',
        code: 'SOURCE_SCHEMA',
        message: 'Source schema not discovered — provide sample JSON or OpenAPI.',
      });
    }

    const mapReport = validateMappings({
      mappings: input.mappings,
      sourceFields: input.sourceFields,
      targetFields: input.targetFields,
    });
    issues.push(...mapReport.issues.filter((i) => i.severity !== 'PASS'));
    if (mapReport.ok) {
      issues.push({
        severity: 'PASS',
        code: 'MAPPINGS',
        message: 'Mappings satisfy required-field checks.',
      });
    }

    if (input.hasMatchingStrategy) {
      issues.push({
        severity: 'PASS',
        code: 'MATCHING',
        message: 'CREATE/UPDATE matching strategy configured.',
      });
    } else {
      issues.push({
        severity: 'WARNING',
        code: 'MATCHING',
        message: 'Matching strategy not explicitly configured — defaults will be used.',
      });
    }

    if (!input.design.language) {
      issues.push({
        severity: 'ERROR',
        code: 'LANGUAGE',
        message: 'Programming language is not selected.',
      });
    } else {
      issues.push({
        severity: 'PASS',
        code: 'LANGUAGE',
        message: `Language selected: ${input.design.language}.`,
      });
    }

    return {
      ok: issues.every((i) => i.severity !== 'ERROR'),
      issues,
    };
  }

  async dryRun(input: {
    sourceRecords: Record<string, unknown>[];
    mappings: FieldMappingSpec[];
    targetFields?: DiscoveredField[];
  }): Promise<DryRunResult> {
    return runDryRun(input);
  }

  async reviewIntegration(design: IntegrationDesign) {
    return {
      summary: `${design.direction} ${design.source} → ${design.target} (${design.executionMode}) using ${design.language}`,
      recommendations: [
        'Confirm authentication and credential references before activation.',
        'Review LOW-confidence mappings before production.',
        'Validate SSRF / allowlist policy for source and target URLs.',
        'Do not activate until DESIGN_READY → VALIDATED → APPROVED.',
        'Run a dry run to preview transformed target records.',
      ],
    };
  }

  recommendMatchingStrategy(mappings: FieldMappingSpec[]) {
    return defaultMatchingStrategy(mappings);
  }
}
