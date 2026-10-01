/**
 * DEV-only platform promotion package types.
 * Future target: DEV → QA → PROD (QA/PROD not provisioned in this phase).
 */

export type ComponentKind =
  | 'organization'
  | 'project'
  | 'form'
  | 'form_field'
  | 'role'
  | 'permission'
  | 'group'
  | 'workflow'
  | 'notification_template'
  | 'integration'
  | 'mapping'
  | 'transformation'
  | 'reference_data'
  | 'report'
  | 'dashboard'
  | 'business_rule'
  | 'schedule'
  | 'itam_config'
  | 'attachment_config'
  | 'audit_config';

export type Classification =
  | 'PLATFORM_CONFIGURATION'
  | 'ENVIRONMENT_CONFIGURATION'
  | 'TRANSACTIONAL_DATA'
  | 'REFERENCE_DATA'
  | 'SECRET';

export type DiffAction =
  | 'CREATE'
  | 'UPDATE'
  | 'NO_CHANGE'
  | 'CONFLICT'
  | 'MISSING_DEPENDENCY'
  | 'INVALID_REFERENCE'
  | 'BLOCKED';

export interface PackageManifest {
  package: {
    key: string;
    version: string;
    displayName?: string;
    description?: string;
    /** Always DEV for this phase */
    sourceEnvironment: 'DEV';
    createdAt: string;
    createdBy?: string;
  };
  requires: {
    platformVersion: string;
  };
  components: ComponentKind[];
  /** Logical keys included in this package (for quick inventory). */
  logicalKeys: string[];
}

export interface LogicalRef {
  /** Stable logical key, e.g. grc.risk.owner */
  key: string;
  kind: ComponentKind;
}

export interface PackagedComponent {
  kind: ComponentKind;
  key: string;
  classification: Classification;
  version?: string;
  /** Declarative definition — never includes secrets */
  definition: Record<string, unknown>;
  /** Logical dependencies this component requires */
  dependsOn: LogicalRef[];
  /** Environment-specific slots (URLs, credential refs) — values omitted from package */
  environmentSlots?: string[];
}

export interface PlatformPackage {
  manifest: PackageManifest;
  components: PackagedComponent[];
}

export interface DiffItem {
  kind: ComponentKind;
  key: string;
  action: DiffAction;
  detail?: string;
  sourceFingerprint?: string;
  targetFingerprint?: string;
}

export interface DryRunResult {
  packageKey: string;
  packageVersion: string;
  targetNamespace: string;
  environment: 'DEV';
  summary: Record<DiffAction, number>;
  items: DiffItem[];
  wouldWrite: boolean; // always false for dry-run
}

export interface ImportResult {
  dryRun: boolean;
  packageKey: string;
  packageVersion: string;
  targetNamespace: string;
  applied: DiffItem[];
  blocked: DiffItem[];
  audit: PromotionAuditRecord;
}

export interface PromotionAuditRecord {
  id: string;
  packageKey: string;
  packageVersion: string;
  sourceEnvironment: 'DEV';
  /** Future: DEV | QA | PROD — this phase only uses DEV isolated namespaces */
  targetEnvironment: 'DEV';
  targetNamespace: string;
  initiatedBy: string;
  approvedBy?: string | null;
  timestamp: string;
  result: 'DRY_RUN' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  components: DiffItem[];
  failures: string[];
}

export interface NamespaceRecord {
  kind: ComponentKind;
  key: string;
  definition: Record<string, unknown>;
  fingerprint: string;
  updatedAt: string;
}

export interface IsolatedNamespace {
  id: string;
  /** e.g. promotion-test-grc-v1 */
  name: string;
  organizationLogicalKey: string;
  createdAt: string;
  records: Map<string, NamespaceRecord>; // key = `${kind}:${logicalKey}`
}
