/**
 * Phase 5–10 shared domain types for enterprise AI integration platform.
 * Synced conceptually with packages/vis-core — kept in backend for Nest runtime.
 */

export const PLATFORM_ROLES = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'INTEGRATION_ADMIN',
  'DEVELOPER',
  'REVIEWER',
  'OPERATIONS',
  'VIEWER',
] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_PERMISSIONS = [
  'integration:create',
  'integration:read',
  'integration:update',
  'integration:delete',
  'integration:approve',
  'integration:activate',
  'integration:execute',
  'integration:pause',
  'integration:replay',
  'credential:create',
  'credential:read',
  'credential:update',
  'credential:delete',
  'connector:install',
  'connector:approve',
  'environment:promote',
  'audit:read',
  'admin:manage',
  'codegen:generate',
  'codegen:approve',
  'reconciliation:run',
  'reconciliation:repair',
  'marketplace:publish',
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<PlatformRole, PlatformPermission[]> = {
  SUPER_ADMIN: [...PLATFORM_PERMISSIONS],
  ORG_ADMIN: PLATFORM_PERMISSIONS.filter((p) => p !== 'admin:manage'),
  INTEGRATION_ADMIN: [
    'integration:create', 'integration:read', 'integration:update', 'integration:delete',
    'integration:approve', 'integration:activate', 'integration:execute', 'integration:pause',
    'integration:replay', 'credential:create', 'credential:read', 'credential:update',
    'environment:promote', 'audit:read', 'codegen:generate', 'codegen:approve',
    'reconciliation:run', 'reconciliation:repair', 'connector:install', 'connector:approve',
    'marketplace:publish',
  ],
  DEVELOPER: [
    'integration:create', 'integration:read', 'integration:update', 'integration:execute',
    'credential:read', 'audit:read', 'codegen:generate', 'reconciliation:run',
  ],
  REVIEWER: [
    'integration:read', 'integration:approve', 'audit:read', 'codegen:approve',
  ],
  OPERATIONS: [
    'integration:read', 'integration:execute', 'integration:pause', 'integration:replay',
    'audit:read', 'reconciliation:run', 'reconciliation:repair',
  ],
  VIEWER: ['integration:read', 'audit:read', 'credential:read'],
};

export const AI_RECOMMENDATION_STATUSES = [
  'PROPOSED', 'REVIEWED', 'APPROVED', 'REJECTED', 'APPLIED', 'ROLLED_BACK',
] as const;
export type AiRecommendationStatus = (typeof AI_RECOMMENDATION_STATUSES)[number];

export const DRIFT_SEVERITIES = ['NON_BREAKING', 'POTENTIALLY_BREAKING', 'BREAKING'] as const;
export type DriftSeverity = (typeof DRIFT_SEVERITIES)[number];

export const CONNECTOR_LIFECYCLE = [
  'DRAFT', 'DEVELOPMENT', 'TESTING', 'CERTIFICATION', 'APPROVED', 'PUBLISHED', 'DEPRECATED', 'RETIRED',
] as const;
export type ConnectorLifecycle = (typeof CONNECTOR_LIFECYCLE)[number];

export const HEALTH_STATUSES = ['HEALTHY', 'DEGRADED', 'FAILING', 'PAUSED', 'DISABLED'] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export const REPAIR_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'IGNORE', 'MANUAL_REVIEW'] as const;
export type RepairAction = (typeof REPAIR_ACTIONS)[number];

export const SAFE_RECOVERY_ACTIONS = [
  'RETRY_TRANSIENT',
  'REFRESH_OAUTH',
  'RECONNECT_CONNECTOR',
  'RESTART_WORKER',
  'REQUEUE_JOB',
  'RESPECT_RETRY_AFTER',
  'OPEN_CIRCUIT',
  'CLOSE_CIRCUIT',
  'REDUCE_CONCURRENCY',
  'REPLAY_SAFE_EVENT',
  'RESUME_CHECKPOINT',
] as const;
export type SafeRecoveryAction = (typeof SAFE_RECOVERY_ACTIONS)[number];

export const GOVERNANCE_ENVIRONMENTS = ['DEV', 'TEST', 'UAT', 'PROD'] as const;
export type GovernanceEnvironment = (typeof GOVERNANCE_ENVIRONMENTS)[number];

export const PROMOTION_ORDER: GovernanceEnvironment[] = ['DEV', 'TEST', 'UAT', 'PROD'];

export const INTEGRATION_LIFECYCLE = [
  'DRAFT',
  'ANALYZING',
  'DESIGN_READY',
  'NEEDS_REVIEW',
  'VALIDATED',
  'APPROVED',
  'ACTIVATING',
  'ACTIVE',
  'PAUSED',
  'DISABLED',
  'DEPRECATED',
] as const;
export type IntegrationLifecycle = (typeof INTEGRATION_LIFECYCLE)[number];

export interface CodegenSpec {
  integrationId: string;
  versionId: string;
  language: 'PYTHON' | 'TYPESCRIPT' | 'JAVA' | 'CSHARP' | 'GO';
  designSummary: string;
  sourceKind: string;
  targetKind: string;
  operations: string[];
  mappings: Array<{ sourceField: string; targetField: string; transformation?: string | null }>;
  matchingStrategy: { sourceFields: string[]; targetFields: string[] };
  retryPolicy: string;
  rateLimitPerMinute: number | null;
  eventEnabled?: boolean;
}

export interface GeneratedArtifact {
  language: string;
  files: Array<{ path: string; content: string }>;
  validation: { ok: boolean; errors: string[]; warnings: string[] };
  securityScan: { ok: boolean; findings: string[] };
  dependencyScan: { ok: boolean; findings: string[] };
  status: 'GENERATED' | 'VALIDATED' | 'REJECTED' | 'APPROVED';
}

export interface AiRecommendation {
  id: string;
  type: string;
  reason: string;
  evidence: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  affectedIntegrationId?: string | null;
  affectedVersionId?: string | null;
  proposedChange: Record<string, unknown>;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  status: AiRecommendationStatus;
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  /** When true, violation blocks the action */
  blocking: boolean;
  evaluate: (ctx: PolicyContext) => PolicyResult;
}

export interface PolicyContext {
  action: string;
  environment?: string;
  integrationId?: string;
  principalRoles?: PlatformRole[];
  securityScanOk?: boolean;
  connectorApproved?: boolean;
  approvalCount?: number;
  requiredApprovals?: number;
}

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
  ruleId?: string;
}

export interface AutomatedRecoveryAction {
  actionType: SafeRecoveryAction;
  trigger: string;
  constraints: Record<string, unknown>;
  maximumAttempts: number;
  cooldownMs: number;
  auditRequired: boolean;
  autoApproved: boolean;
}

export interface DriftFinding {
  id: string;
  kind: string;
  field?: string;
  from?: unknown;
  to?: unknown;
  severity: DriftSeverity;
  source: string;
  detectedAt: string;
}

export interface ConnectorManifest {
  name: string;
  vendor: string;
  version: string;
  category: string;
  description: string;
  capabilities: string[];
  authentication: string[];
  operations: string[];
  documentation?: string;
  compatibility?: string[];
  visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
  lifecycle: ConnectorLifecycle;
  securityStatus: 'PENDING' | 'PASSED' | 'FAILED';
  publisher: string;
}
