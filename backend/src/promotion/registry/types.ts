import { createHash } from 'crypto';

export type PromotionStatus =
  | 'Draft'
  | 'Validating'
  | 'Ready'
  | 'Promoting'
  | 'Completed'
  | 'Failed'
  | 'PartiallyCompleted';

export type ValidationSeverity = 'ready' | 'warning' | 'conflict';
export type SelectionSource = 'explicit' | 'dependency';
export type ExecutionItemStatus =
  | 'pending'
  | 'promoting'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'identical';

export type PromotableObjectType =
  | 'form'
  | 'workflow'
  | 'report'
  | 'dashboard'
  | 'email_template'
  | 'role'
  | 'org_user'
  | 'group'
  | 'data_feed'
  | 'kb_folder'
  | 'policy'
  | 'vis_integration'
  | 'asset_category'
  | 'itam_sync_mapping'
  | 'saved_query';

export type PromotionModule =
  | 'Forms'
  | 'Workflows'
  | 'Reports'
  | 'Notifications'
  | 'Access Control'
  | 'Data Feed'
  | 'Knowledge Base'
  | 'Integration Studio'
  | 'IT Asset'
  | 'SQL Builder';

export interface RegistryEntry {
  objectType: PromotableObjectType;
  displayName: string;
  module: PromotionModule;
  promotable: true;
  supportsRecordSelection: boolean;
  hasDependencies: boolean;
  promotionStrategy: 'upsert_by_stable_id';
  conflictStrategy: 'block' | 'warn_and_update';
  versioning: 'content_hash' | 'updated_at';
  childTypes: string[];
  description: string;
}

export interface ObjectRef {
  objectType: PromotableObjectType;
  objectId: string;
  stableId: string;
  name: string;
  module: PromotionModule;
  devVersion?: string;
  prodVersion?: string | null;
  projectId?: string | null;
  organizationId?: string | null;
  updatedAt?: string | null;
}

export interface DependencyRef {
  objectType: PromotableObjectType;
  objectId: string;
  stableId: string;
  name: string;
  reason: string;
  required: boolean;
}

export interface PortableObject {
  objectType: PromotableObjectType;
  objectId: string;
  stableId: string;
  name: string;
  version: string;
  contentHash: string;
  portable: Record<string, unknown>;
  children?: Record<string, unknown[]>;
  envSpecificStripped?: string[];
}

export interface ValidationFinding {
  objectType?: PromotableObjectType | string;
  stableId?: string;
  severity: ValidationSeverity;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** How nested config children are applied when the parent already exists on Prod. */
export type ChildApplyMode = 'replace' | 'merge';

export type MappingStatus = 'matched' | 'new' | 'unresolved' | 'stripped';

export interface MappingEntry {
  kind:
    | 'object'
    | 'field'
    | 'option'
    | 'user'
    | 'role'
    | 'group'
    | 'form_ref'
    | 'org'
    | 'project';
  objectType: string;
  objectStableId: string;
  objectName: string;
  /** Human label for the mapped element (field label, email, role name, …) */
  label: string;
  /** Dev-side identity */
  sourceKey: string;
  /** Prod-side identity when resolved */
  targetKey: string | null;
  status: MappingStatus;
  detail?: string;
}

export interface MappingReport {
  childApplyMode: ChildApplyMode;
  generatedAt: string;
  counts: {
    matched: number;
    new: number;
    unresolved: number;
    stripped: number;
    total: number;
  };
  entries: MappingEntry[];
  blockers: string[];
}

export interface TransferContext {
  packageId: string;
  actorId: string;
  sourceKey: string;
  targetKey: string;
  organizationId?: string | null;
  projectId?: string | null;
  targetOrganizationId?: string | null;
  projectMap: Record<string, string>;
  dualDb: boolean;
  /** Default replace — deep refresh of selected object children (Archer default). */
  childApplyMode?: ChildApplyMode;
}

export function contentHash(value: unknown): string {
  const json = JSON.stringify(value, Object.keys(value as object).sort?.() ? undefined : undefined);
  return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 16);
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function versionFromPayload(portable: Record<string, unknown>, updatedAt?: string | null): string {
  const hash = contentHash(portable);
  if (updatedAt) {
    return `v-${updatedAt.replace(/[:.]/g, '-')}-${hash.slice(0, 8)}`;
  }
  return `v-${hash}`;
}
