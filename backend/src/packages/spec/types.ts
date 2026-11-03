// Generated from packages/package-spec/src by scripts/sync-package-spec.mjs. Do not edit.
export const PACKAGE_FORMAT = 'topsqill-package';
export const PACKAGE_FORMAT_VERSION = 1;

export const PACKAGE_OBJECT_TYPES = ['solution', 'form', 'workflow', 'report'] as const;
export type PackageObjectType = (typeof PACKAGE_OBJECT_TYPES)[number];

export const PACKAGE_LICENSES = ['free', 'paid', 'private'] as const;
export type PackageLicense = (typeof PACKAGE_LICENSES)[number];

export const KNOWN_MODULES = ['ai-builder', 'asset-discovery', 'integration-studio', 'promotional-transfer', 'real-estate'] as const;

export interface PackageManifest {
  /** Stable identity across versions, e.g. "asset-management". */
  key: string;
  name: string;
  /** Semantic version, e.g. "1.2.0". */
  version: string;
  publisher: string;
  description: string;
  license: PackageLicense;
  requires: {
    /** Paid modules the organisation must have before installing. */
    modules: string[];
  };
  createdAt: string;
}

/**
 * One configuration object. `key` is `${type}:${sourceId}` and never changes between versions,
 * which is how an upgrade finds the object it installed before.
 */
export interface PackageObject<T = Record<string, unknown>> {
  type: PackageObjectType;
  key: string;
  name: string;
  data: T;
}

export interface PackageIntegrity {
  algorithm: 'sha256';
  checksum: string;
}

export interface PackageSignature {
  algorithm: 'ed25519';
  keyId: string;
  value: string;
}

export interface PackageFile {
  format: typeof PACKAGE_FORMAT;
  formatVersion: typeof PACKAGE_FORMAT_VERSION;
  manifest: PackageManifest;
  objects: PackageObject[];
  integrity: PackageIntegrity;
  signature: PackageSignature | null;
}

export interface SolutionData {
  solution: { id: string; name: string; color?: string | null };
  formIds: string[];
}

export interface FormData {
  form: Record<string, unknown> & { id: string; name: string };
  fields: (Record<string, unknown> & { id: string })[];
}

export interface WorkflowData {
  workflow: Record<string, unknown> & { id: string; name: string };
  nodes: (Record<string, unknown> & { id: string })[];
  connections: (Record<string, unknown> & { id: string })[];
  triggers: (Record<string, unknown> & { id: string })[];
}

export interface ReportData {
  report: Record<string, unknown> & { id: string; name: string };
  components: (Record<string, unknown> & { id: string })[];
}
