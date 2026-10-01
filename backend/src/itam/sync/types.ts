/**
 * ITAM Form Sync — types.
 * Existing application Form API is the SoR for asset records.
 * This module stores only sync metadata / mappings / provenance.
 */
import type { FieldMappingSpec, MappingConfidence } from '../../vis/core/types/index';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'NO_CHANGE' | 'WOULD_CREATE' | 'WOULD_UPDATE';

export type SyncStatus =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'VALIDATION_FAILED'
  | 'REFERENCE_RESOLUTION_FAILED'
  | 'AMBIGUOUS_MATCH'
  | 'API_ERROR'
  | 'AUTHENTICATION_FAILED'
  | 'RATE_LIMITED'
  | 'SCHEMA_CHANGED'
  | 'BLOCKED'
  | 'CONFIGURATION_REQUIRED'
  | 'NO_CHANGE'
  | 'DRY_RUN';

export interface NormalizedAsset {
  tenantId: string;
  discoverySource: string;
  externalId: string;
  assetType: string;
  hostname?: string;
  fqdn?: string;
  ipAddresses: string[];
  macAddresses: string[];
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  biosUuid?: string;
  machineGuid?: string;
  cloudInstanceId?: string;
  operatingSystem?: string;
  osVersion?: string;
  deviceType?: string;
  cloudProvider?: string;
  cloudAccountId?: string;
  cloudRegion?: string;
  cloudResourceId?: string;
  virtualizationProvider?: string;
  virtualizationHost?: string;
  tags: Record<string, string>;
  firstSeen?: string;
  lastSeen?: string;
  confidence?: string;
  provenance: Record<string, string>;
  /** Flat map for mapping engine */
  fields: Record<string, unknown>;
}

export interface FormFieldSchema {
  id?: string;
  name: string;
  /** Portable stable key when available (logical_key) — preferred mapping identity */
  logicalKey?: string;
  label?: string;
  type: string;
  required?: boolean;
  nullable?: boolean;
  readOnly?: boolean;
  editable?: boolean;
  allowedValues?: string[];
  maxLength?: number;
  unique?: boolean;
  reference?: { formHint?: string; matchBy?: string };
}

export interface FormSchemaSnapshot {
  formId: string;
  formName: string;
  version: string;
  fields: FormFieldSchema[];
  fetchedAt: string;
  hash: string;
}

export interface SyncMappingDefinition {
  id: string;
  organizationId: string;
  name: string;
  targetFormId: string;
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'REJECTED' | 'STALE';
  mappings: FieldMappingSpec[];
  matchingSourceFields: string[];
  matchingTargetFields: string[];
  mappingSource: 'MANUAL' | 'AI_PROPOSED' | 'DETERMINISTIC';
  confidence?: MappingConfidence;
  reasoning?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncTargetConfig {
  id: string;
  organizationId: string;
  name: string;
  /** Base URL of existing application API — never invent endpoints */
  baseUrl: string;
  credentialReferenceId: string;
  formsPath: string;
  formFieldsPath: string;
  recordsPath: string;
  recordByIdPath: string;
  searchPath?: string;
  targetFormId?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncValidationError {
  field?: string;
  sourceField?: string;
  targetField?: string;
  valueType?: string;
  expectedType?: string;
  reason: string;
}

export interface SyncItemResult {
  externalId: string;
  operation: SyncOperation | 'AMBIGUOUS_MATCH' | 'BLOCKED' | 'SKIP';
  status: SyncStatus;
  targetRecordId?: string;
  changedFields?: string[];
  validationErrors?: SyncValidationError[];
  mappedPayload?: Record<string, unknown>;
  matchCandidates?: Array<{ id: string; score: number; keys: string[] }>;
  error?: string;
  errorCategory?: string;
  provenance?: Record<string, unknown>;
}

export interface SyncRun {
  id: string;
  organizationId: string;
  targetConfigId: string;
  mappingId?: string;
  mappingVersion?: number;
  schemaVersion?: string;
  mode: 'DRY_RUN' | 'EXECUTE';
  status: SyncStatus | 'RUNNING' | 'COMPLETED' | 'FAILED';
  correlationId: string;
  executionId: string;
  totals: {
    discovered: number;
    created: number;
    updated: number;
    noChange: number;
    ambiguous: number;
    failed: number;
    blocked: number;
  };
  items: SyncItemResult[];
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
}

export interface SyncHistoryRow {
  id: string;
  organizationId: string;
  externalId: string;
  targetFormId: string;
  targetRecordId?: string;
  operation: string;
  status: string;
  changedFields: string[];
  mappingVersion?: number;
  schemaVersion?: string;
  executionId?: string;
  errorCategory?: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface FieldProvenanceRow {
  id: string;
  organizationId: string;
  externalId: string;
  targetRecordId?: string;
  targetField: string;
  value?: string;
  sourceProvider?: string;
  sourceField?: string;
  mappingId?: string;
  mappingVersion?: number;
  syncedAt: string;
}

export interface CorrelationLink {
  id: string;
  organizationId: string;
  externalId: string;
  targetFormId: string;
  targetRecordId: string;
  identityKeys: Record<string, string>;
  lastSyncedAt: string;
  lastOperation: string;
}
