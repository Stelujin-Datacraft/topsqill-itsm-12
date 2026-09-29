/**
 * Versatile Integration Studio — shared domain types (Phase 1 + Phase 2).
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

/** Phase 2 design workflow statuses (extends Phase 1 set). */
export const INTEGRATION_STATUSES = [
  'DRAFT',
  'ANALYZING',
  'DESIGN_READY',
  'NEEDS_REVIEW',
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
  'STARTING',
  'RUNNING',
  'PAUSING',
  'PAUSED',
  'COMPLETING',
  'SUCCESS',
  'PARTIAL_SUCCESS',
  'FAILED',
  'CANCELLED',
] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const EXECUTION_ERROR_CODES = [
  'AUTHENTICATION_ERROR',
  'AUTHORIZATION_ERROR',
  'RATE_LIMIT_ERROR',
  'NETWORK_ERROR',
  'TIMEOUT_ERROR',
  'VALIDATION_ERROR',
  'MAPPING_ERROR',
  'TRANSFORMATION_ERROR',
  'SOURCE_ERROR',
  'TARGET_ERROR',
  'CONFIGURATION_ERROR',
  'UNKNOWN_ERROR',
] as const;
export type ExecutionErrorCode = (typeof EXECUTION_ERROR_CODES)[number];

export const PAGINATION_STYLES = [
  'PAGE',
  'OFFSET',
  'LIMIT',
  'CURSOR',
  'NEXT_URL',
  'LINK_HEADER',
  'NONE',
] as const;
export type PaginationStyle = (typeof PAGINATION_STYLES)[number];

/** Validated plan derived from an approved IntegrationDesign + DirectionConfig. */
export interface ExecutionPlan {
  integrationId: string;
  versionId: string | null;
  versionNumber?: number | null;
  correlationId: string;
  source: {
    kind: ConnectorKind;
    connectionId: string | null;
    listPath?: string | null;
    pagination?: PaginationStyle;
    pageSize?: number;
  };
  target: {
    kind: ConnectorKind;
    connectionId: string | null;
    formId: string | null;
  };
  direction: IntegrationDirectionKind;
  operations: CrudOperation[];
  mappings: FieldMappingSpec[];
  matchingStrategy: MatchingStrategy;
  authentication: { authType: AuthType; credentialRefId: string | null };
  batching: { batchSize: number; preferBulk: boolean };
  workers: { count: number; concurrencyPerWorker: number };
  retryPolicy: {
    type: RetryPolicy;
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
  };
  rateLimit: { perMinute: number | null; maxConcurrent: number };
  idempotency: { strategy: string };
  timeouts: { connectionMs: number; readMs: number; totalMs: number };
  language: ProgrammingLanguage;
}

export interface ExecutionMetrics {
  recordsRead: number;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  recordsRetried: number;
  recordsSkipped: number;
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitResponses: number;
  authenticationRefreshes: number;
  startedAt?: string | null;
  completedAt?: string | null;
  recordsPerSecond?: number;
  averageLatencyMs?: number;
}

export interface ExecutionError {
  code: ExecutionErrorCode;
  message: string;
  retryable: boolean;
  source?: string;
  target?: string;
  httpStatus?: number;
  correlationId?: string;
  recordId?: string;
}

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

export const VALIDATION_SEVERITIES = ['PASS', 'WARNING', 'ERROR'] as const;
export type ValidationSeverity = (typeof VALIDATION_SEVERITIES)[number];

export const FIELD_DATA_TYPES = [
  'STRING',
  'INTEGER',
  'DECIMAL',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'CHOICE',
  'REFERENCE',
  'ARRAY',
  'OBJECT',
  'LONG_TEXT',
  'TEXT',
] as const;
export type FieldDataType = (typeof FIELD_DATA_TYPES)[number];

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
    reason?: string | null;
  }>;
  /** Phase 2 recommendation metadata for UI cards */
  recommendations?: DesignRecommendation[];
}

export interface DesignRecommendation {
  area: string;
  recommendation: string;
  reason: string;
  confidence: MappingConfidence;
}

export interface FieldMappingSpec {
  id: string;
  sourceField: string;
  targetField: string;
  transformation?: string | null;
  defaultValue?: unknown;
  required?: boolean;
  confidence?: MappingConfidence;
  /** 0–100 numeric confidence for UI filters */
  confidencePercent?: number;
  enabled?: boolean;
  reason?: string | null;
  lookup?: {
    formHint?: string;
    matchBy?: string;
    sourceField?: string;
  } | null;
}

export interface MatchingStrategy {
  mode: 'SINGLE' | 'COMPOSITE';
  sourceFields: string[];
  targetFields: string[];
  ifFound: 'UPDATE';
  ifNotFound: 'CREATE';
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
  matchingStrategy?: MatchingStrategy | null;
  endpointConfig?: Record<string, unknown>;
  mappings: FieldMappingSpec[];
  schedule?: ScheduleSpec | null;
  selectedFormId?: string | null;
  openApiDocumentRef?: string | null;
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

/** Phase 2 — AI clarification when requirement is incomplete. */
export interface ClarificationOption {
  value: string;
  label: string;
}

export interface ClarificationQuestion {
  id: string;
  field: string;
  prompt: string;
  options?: ClarificationOption[];
  allowCustom?: boolean;
}

export interface ClarificationResult {
  needsClarification: true;
  questions: ClarificationQuestion[];
  partialHints?: Record<string, unknown>;
}

export interface ClarificationAnswers {
  [questionId: string]: string;
}

export interface SchemaFieldDiff {
  name: string;
  change: 'ADDED' | 'REMOVED' | 'CHANGED' | 'NEW_REQUIRED';
  before?: Partial<DiscoveredField> | null;
  after?: Partial<DiscoveredField> | null;
}

export interface SchemaDiffResult {
  changed: boolean;
  added: string[];
  removed: string[];
  changedFields: string[];
  newlyRequired: string[];
  details: SchemaFieldDiff[];
  message?: string;
}

export interface DesignValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  field?: string;
}

export interface DesignValidationReport {
  ok: boolean;
  issues: DesignValidationIssue[];
}

export interface DryRunRecordPreview {
  source: Record<string, unknown>;
  target: Record<string, unknown>;
  warnings: string[];
  errors: string[];
}

export interface DryRunResult {
  dryRun: true;
  sampleSize: number;
  previews: DryRunRecordPreview[];
  mappingIssues: DesignValidationIssue[];
}

export interface OpenApiEndpoint {
  path: string;
  method: string;
  summary?: string;
  operationId?: string;
  parameters?: unknown[];
  requestSchema?: unknown;
  responseSchema?: unknown;
}
