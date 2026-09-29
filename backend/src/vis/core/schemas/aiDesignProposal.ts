/**
 * Strict Zod schema for Phase-2 structured AI design proposals.
 * Maps into the application IntegrationDesign — never save unvalidated AI output.
 */
import { z } from 'zod';
import {
  AUTH_TYPES,
  CONNECTOR_KINDS,
  CRUD_OPERATIONS,
  EXECUTION_MODES,
  INTEGRATION_DIRECTIONS,
  MAPPING_CONFIDENCE,
  PROGRAMMING_LANGUAGES,
  RETRY_POLICIES,
  SCHEDULE_KINDS,
} from '../types/index';
import type { IntegrationDesign } from '../types/index';
import { IntegrationDesignSchema } from './integrationDesign';

export const AiDesignProposalSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  summary: z.string().min(1).max(2000).optional(),
  source: z.object({
    type: z.enum(CONNECTOR_KINDS),
    system: z.string().min(1).max(200).optional(),
  }),
  target: z.object({
    type: z.enum(CONNECTOR_KINDS),
    formName: z.string().min(1).max(200).optional(),
  }),
  direction: z.enum(INTEGRATION_DIRECTIONS),
  executionMode: z.enum(EXECUTION_MODES),
  schedule: z
    .object({
      type: z.enum(SCHEDULE_KINDS),
      value: z.number().int().positive().nullable().optional(),
      unit: z.enum(['MINUTES', 'HOURS', 'DAYS']).nullable().optional(),
    })
    .optional(),
  operations: z.array(z.enum(CRUD_OPERATIONS)).min(1),
  language: z.enum(PROGRAMMING_LANGUAGES),
  languageReason: z.string().min(1).max(1000).optional(),
  workers: z.number().int().min(1).max(500),
  batchSize: z.number().int().min(1).max(100_000),
  concurrency: z.number().int().min(1).max(1000).optional(),
  retryPolicy: z.enum(RETRY_POLICIES).optional(),
  rateLimitPerMinute: z.number().int().positive().nullable().optional(),
  idempotencyStrategy: z
    .enum(['EXTERNAL_ID', 'UNIQUE_KEY', 'COMPOSITE_KEY', 'IDEMPOTENCY_KEY'])
    .optional(),
  authHint: z.enum(AUTH_TYPES).optional(),
  suggestedMappings: z
    .array(
      z.object({
        sourceField: z.string(),
        targetField: z.string(),
        confidence: z.enum(MAPPING_CONFIDENCE),
        transformation: z.string().nullable().optional(),
        reason: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

export type AiDesignProposal = z.infer<typeof AiDesignProposalSchema>;

export function validateAiDesignProposal(input: unknown): AiDesignProposal {
  return AiDesignProposalSchema.parse(input);
}

/** Convert structured AI proposal → application IntegrationDesign (Zod-validated). */
export function aiProposalToIntegrationDesign(
  proposal: AiDesignProposal,
  promptSummary?: string,
): IntegrationDesign {
  const schedule = proposal.schedule;
  let frequency: string | null = null;
  let scheduleKind = schedule?.type || null;
  if (schedule?.type === 'INTERVAL' && schedule.value && schedule.unit === 'MINUTES') {
    frequency = `${schedule.value}_MINUTES`;
  } else if (schedule?.type === 'HOURLY') {
    frequency = 'HOURLY';
  } else if (schedule?.type === 'DAILY') {
    frequency = 'DAILY';
  }

  const design: IntegrationDesign = {
    name: proposal.name,
    summary:
      proposal.summary
      || promptSummary?.trim().slice(0, 500)
      || 'Integration from structured AI proposal',
    source: proposal.source.type,
    target: proposal.target.type,
    direction: proposal.direction,
    executionMode: proposal.executionMode,
    frequency,
    scheduleKind,
    operations: proposal.operations,
    language: proposal.language,
    languageReason:
      proposal.languageReason
      || 'Recommended based on REST / transformation workload characteristics.',
    workers: proposal.workers,
    batchSize: proposal.batchSize,
    concurrency: proposal.concurrency || proposal.workers,
    retryPolicy: proposal.retryPolicy || 'EXPONENTIAL',
    rateLimitPerMinute: proposal.rateLimitPerMinute ?? 120,
    idempotencyStrategy: proposal.idempotencyStrategy || 'EXTERNAL_ID',
    authHint: proposal.authHint || 'OAUTH2',
    sourceHints: {
      system: proposal.source.system || null,
      vendorExample: proposal.source.system || 'Generic',
    },
    targetHints: {
      formHint: proposal.target.formName || null,
      formName: proposal.target.formName || null,
    },
    suggestedMappings: (proposal.suggestedMappings || []).map((m) => ({
      sourceField: m.sourceField,
      targetField: m.targetField,
      confidence: m.confidence,
      transformation: m.transformation ?? null,
      reason: m.reason ?? null,
    })),
    recommendations: [
      {
        area: 'LANGUAGE',
        recommendation: proposal.language,
        reason:
          proposal.languageReason
          || 'Recommended based on REST / transformation workload characteristics.',
        confidence: 'HIGH',
      },
      {
        area: 'EXECUTION',
        recommendation: proposal.executionMode,
        reason: schedule
          ? `Schedule ${schedule.type}${schedule.value ? ` ${schedule.value} ${schedule.unit}` : ''}`
          : 'Derived from the natural-language requirement',
        confidence: 'HIGH',
      },
      {
        area: 'PERFORMANCE',
        recommendation: `workers=${proposal.workers}, batchSize=${proposal.batchSize}`,
        reason: 'Balanced defaults for moderate API throughput',
        confidence: 'MEDIUM',
      },
      {
        area: 'RELIABILITY',
        recommendation: proposal.retryPolicy || 'EXPONENTIAL',
        reason: 'Exponential backoff reduces thundering-herd pressure on remote APIs',
        confidence: 'HIGH',
      },
    ],
  };

  return IntegrationDesignSchema.parse(design) as IntegrationDesign;
}
