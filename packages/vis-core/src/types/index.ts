/**
 * Versatile Integration Studio — shared domain types (Phase 1 foundation).
 * Extensible for bidirectional directions, multi-language runtimes, workers, etc.
 */

export const CONNECTOR_KINDS = [
  'REST_API',
  'DATABASE',
  'INTERNAL_APPLICATION_API',
] as const;
export type ConnectorKind = (typeof CONNECTOR_KINDS)[number];

export const INTEGRATION_DIRECTIONS = ['UNIDIRECTIONAL', 'BIDIRECTIONAL'] as const;
export type IntegrationDirectionKind = (typeof INTEGRATION_DIRECTIONS)[number];

export const EXECUTION_MODES = [
  'REALTIME',
  'SCHEDULED',
  'EVENT_DRIVEN',
  'MANUAL',
  'ON_DEMAND',
  'BATCH',
] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const CRUD_OPERATIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'UPSERT'] as const;
export type CrudOperation = (typeof CRUD_OPERATIONS)[number];

export const PROGRAMMING_LANGUAGES = [
  'PYTHON',
  'TYPESCRIPT',
  'JAVA',
  'CSHARP',
  'GO',
] as const;
export type ProgrammingLanguage = (typeof PROGRAMMING_LANGUAGES)[number];

export const AUTH_TYPES = [
  'API_KEY',
  'BASIC_AUTH',
  'BEARER_TOKEN',
  'OAUTH2',
  'DATABASE',
  'NONE',
] as const;
export type AuthType = (typeof AUTH_TYPES)[number];

export const INTEGRATION_STATUSES = [
  'DRAFT',
  'VALIDATED',
  'APPROVED',
  'ACTIVE',
  'INACTIVE',
] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const VERSION_STATUSES = ['DRAFT', 'PUBLISHED', 'DEPRECATED'] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export const EXECUTION_STATUSES = [
  'QUEUED',
  'RUNNING',
  'SUCCESS',
  'PARTIAL_SUCCESS',
  'FAILED',
  'CANCELLED',
] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const ENVIRONMENTS = ['DEV', 'TEST', 'UAT', 'PROD'] as const;
export type EnvironmentName = (typeof ENVIRONMENTS)[number];

export const MAPPING_CONFIDENCE = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type MappingConfidence = (typeof MAPPING_CONFIDENCE)[number];

export const RETRY_POLICIES = ['NONE', 'FIXED', 'EXPONENTIAL'] as const;
export type RetryPolicy = (typeof RETRY_POLICIES)[number];

export const SCHEDULE_KINDS = [
  'MANUAL',
  'INTERVAL',
  'HOURLY',
  'DAILY',
  'WEEKLY',
  'CRON',
] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/** AI-produced, schema-validated design object (never free-form config). */
export interface IntegrationDesign {
  name?: string;
  summary: string;
  source: ConnectorKind;
  target: ConnectorKind;
  direction: IntegrationDirectionKind;
  executionMode: ExecutionMode;
  frequency?: string | null;
  scheduleKind?: ScheduleKind | null;
  operations: CrudOperation[];
  language: ProgrammingLanguage;
  languageReason: string;
  workers: number;
  batchSize: number;
  concurrency?: number;
  retryPolicy?: RetryPolicy;
  rateLimitPerMinute?: number | null;
  idempotencyStrategy?: 'EXTERNAL_ID' | 'UNIQUE_KEY' | 'COMPOSITE_KEY' | 'IDEMPOTENCY_KEY';
  authHint?: AuthType;
  sourceHints?: Record<string, unknown>;
  targetHints?: Record<string, unknown>;
  suggestedMappings?: Array<{
    sourceField: string;
    targetField: string;
    confidence: MappingConfidence;
    transformation?: string | null;
  }>;
}

export interface FieldMappingSpec {
  id: string;
  sourceField: string;
  targetField: string;
  transformation?: string | null;
  defaultValue?: unknown;
  required?: boolean;
  confidence?: MappingConfidence;
  enabled?: boolean;
}

export interface DirectionConfig {
  id: string;
  label: string;
  /** A_TO_B or B_TO_A */
  flow: 'A_TO_B' | 'B_TO_A';
  sourceConnectionId?: string | null;
  targetConnectionId?: string | null;
  sourceKind: ConnectorKind;
  targetKind: ConnectorKind;
  operations: CrudOperation[];
  language: ProgrammingLanguage;
  languageRecommendedByAi?: ProgrammingLanguage | null;
  languageReason?: string | null;
  workers: number;
  batchSize: number;
  concurrency: number;
  retryPolicy: RetryPolicy;
  retryMaxAttempts: number;
  rateLimitPerMinute?: number | null;
  idempotencyStrategy: string;
  matchingKeys: string[];
  endpointConfig?: Record<string, unknown>;
  mappings: FieldMappingSpec[];
  schedule?: ScheduleSpec | null;
}

export interface ScheduleSpec {
  kind: ScheduleKind;
  intervalMinutes?: number | null;
  cron?: string | null;
  allowConcurrent: boolean;
  timezone?: string | null;
}

export interface DiscoveredField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  readOnly?: boolean;
  choices?: Array<{ value: string; label: string }>;
  reference?: { formId?: string; matchBy?: string[] } | null;
}

export interface DiscoveredForm {
  id: string;
  name: string;
  description?: string | null;
  fields?: DiscoveredField[];
}
