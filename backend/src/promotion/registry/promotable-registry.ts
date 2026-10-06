import type { PromotableObjectType, PromotionModule, RegistryEntry } from './types';

/**
 * Central Promotable Object Registry.
 * Only types listed here with promotable:true may appear in the Promotional Transfer UI.
 * Operational/transactional tables are intentionally absent.
 */
export const PROMOTABLE_REGISTRY: RegistryEntry[] = [
  {
    objectType: 'form',
    displayName: 'Form Definition',
    module: 'Forms',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: false,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: ['form_fields'],
    description: 'Form metadata, pages, layout, field rules, and field definitions',
  },
  {
    objectType: 'workflow',
    displayName: 'Workflow Definition',
    module: 'Workflows',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: true,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: ['workflow_nodes', 'workflow_connections'],
    description: 'Workflow graph, nodes, connections, and enrollment settings',
  },
  {
    objectType: 'report',
    displayName: 'Report Definition',
    module: 'Reports',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: true,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: [],
    description: 'Report configuration and metadata',
  },
  {
    objectType: 'dashboard',
    displayName: 'Dashboard Configuration',
    module: 'Reports',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: true,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: [],
    description: 'Dashboard layout and linked report widgets',
  },
  {
    objectType: 'email_template',
    displayName: 'Email / Notification Template',
    module: 'Notifications',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: false,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: [],
    description: 'Notification email template content and variables',
  },
];

/** Explicitly non-promotable categories (documentation / guards). */
export const NON_PROMOTABLE_CATEGORIES = [
  'form_submissions',
  'incidents',
  'service_requests',
  'tickets',
  'audit_logs',
  'form_audit_logs',
  'workflow_queue',
  'workflow_executions',
  'sessions',
  'logs',
  'temporary_data',
  'user_generated_records',
] as const;

export function getRegistryEntry(objectType: string): RegistryEntry | undefined {
  return PROMOTABLE_REGISTRY.find((e) => e.objectType === objectType && e.promotable);
}

export function assertPromotable(objectType: string): RegistryEntry {
  const entry = getRegistryEntry(objectType);
  if (!entry) {
    throw new Error(`Object type "${objectType}" is not registered as promotable`);
  }
  return entry;
}

export function listModules(): { module: PromotionModule; objectTypes: PromotableObjectType[] }[] {
  const map = new Map<PromotionModule, PromotableObjectType[]>();
  for (const e of PROMOTABLE_REGISTRY) {
    const list = map.get(e.module) || [];
    list.push(e.objectType);
    map.set(e.module, list);
  }
  return Array.from(map.entries()).map(([module, objectTypes]) => ({ module, objectTypes }));
}

export function isRegisteredPromotable(objectType: string): objectType is PromotableObjectType {
  return !!getRegistryEntry(objectType);
}
