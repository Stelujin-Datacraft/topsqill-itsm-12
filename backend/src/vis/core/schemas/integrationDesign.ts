/**
 * Strict Zod schemas for AI / API Integration Design validation.
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

export const IntegrationDesignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  summary: z.string().min(1).max(2000),
  source: z.enum(CONNECTOR_KINDS),
  target: z.enum(CONNECTOR_KINDS),
  direction: z.enum(INTEGRATION_DIRECTIONS),
  executionMode: z.enum(EXECUTION_MODES),
  frequency: z.string().nullable().optional(),
  scheduleKind: z.enum(SCHEDULE_KINDS).nullable().optional(),
  operations: z.array(z.enum(CRUD_OPERATIONS)).min(1),
  language: z.enum(PROGRAMMING_LANGUAGES),
  languageReason: z.string().min(1).max(1000),
  workers: z.number().int().min(1).max(500),
  batchSize: z.number().int().min(1).max(100_000),
  concurrency: z.number().int().min(1).max(1000).optional(),
  retryPolicy: z.enum(RETRY_POLICIES).optional(),
  rateLimitPerMinute: z.number().int().positive().nullable().optional(),
  idempotencyStrategy: z
    .enum(['EXTERNAL_ID', 'UNIQUE_KEY', 'COMPOSITE_KEY', 'IDEMPOTENCY_KEY'])
    .optional(),
  authHint: z.enum(AUTH_TYPES).optional(),
  sourceHints: z.record(z.unknown()).optional(),
  targetHints: z.record(z.unknown()).optional(),
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
  recommendations: z
    .array(
      z.object({
        area: z.string(),
        recommendation: z.string(),
        reason: z.string(),
        confidence: z.enum(MAPPING_CONFIDENCE),
      }),
    )
    .optional(),
});

export type IntegrationDesignParsed = z.infer<typeof IntegrationDesignSchema>;

export function validateIntegrationDesign(input: unknown): IntegrationDesignParsed {
  return IntegrationDesignSchema.parse(input);
}
