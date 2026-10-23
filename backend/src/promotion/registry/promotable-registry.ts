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
  {
    objectType: 'org_user',
    displayName: 'User',
    module: 'Access Control',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: true,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: ['user_role_assignments'],
    description: 'Organization users matched by email, with assigned roles (no passwords)',
  },
  {
    objectType: 'role',
    displayName: 'Role',
    module: 'Access Control',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: false,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: ['role_permissions'],
    description: 'Role definitions and type-wide permission matrix',
  },
  {
    objectType: 'group',
    displayName: 'Group',
    module: 'Access Control',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: true,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: ['group_memberships', 'group_role_assignments'],
    description: 'Groups with role assignments and members (users by email)',
  },
  {
    objectType: 'data_feed',
    displayName: 'Data Feed Definition',
    module: 'Data Feed',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: true,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: [],
    description: 'Data feed mappings and schedule (no runs or credentials)',
  },
  {
    objectType: 'kb_folder',
    displayName: 'Knowledge Base Folder',
    module: 'Knowledge Base',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: false,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: [],
    description: 'KB folder structure (no per-user folder access grants)',
  },
  {
    objectType: 'policy',
    displayName: 'Policy / Audit Document',
    module: 'Knowledge Base',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: true,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: [],
    description: 'Policy and audit document configuration and content',
  },
  {
    objectType: 'vis_integration',
    displayName: 'VIS Integration',
    module: 'Integration Studio',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: false,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: ['versions'],
    description: 'Integration Studio integration + version docs (no secrets/executions)',
  },
  {
    objectType: 'asset_category',
    displayName: 'Asset Category',
    module: 'IT Asset',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: true,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: [],
    description: 'IT asset taxonomy categories (no asset inventory records)',
  },
  {
    objectType: 'itam_sync_mapping',
    displayName: 'ITAM Sync Mapping',
    module: 'IT Asset',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: false,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: [],
    description: 'ITAM form-sync field mappings (no sync runs or credentials)',
  },
  {
    objectType: 'saved_query',
    displayName: 'Saved SQL Query',
    module: 'SQL Builder',
    promotable: true,
    supportsRecordSelection: true,
    hasDependencies: false,
    promotionStrategy: 'upsert_by_stable_id',
    conflictStrategy: 'warn_and_update',
    versioning: 'content_hash',
    childTypes: [],
    description: 'Saved SQL Builder query definitions',
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
  'user_role_assignments',
  'data_feed_runs',
  'knowledge_base_folder_access',
  'policy_approvals',
  'policy_ratings',
  'vis_secret_blobs',
  'it_assets',
  'itam_discovered_hosts',
  'itam_discovery_runs',
  'itam_sync_runs',
  'itam_sync_history',
] as const;

/** Human-readable module blurbs for the Create wizard (API + FE mirror). */
export const MODULE_DESCRIPTIONS: Record<string, string> = {
  Forms: 'Form definitions, layouts, and field configuration',
  Workflows: 'Workflow graphs, nodes, and connections',
  Reports: 'Report definitions and dashboard layouts',
  Notifications: 'Email / notification templates',
  'Access Control': 'Users, roles, and groups (select each record to transfer)',
  'Data Feed': 'Data feed definitions and field mappings (no run history)',
  'Knowledge Base': 'Folders and policy/audit documents',
  'Integration Studio': 'VIS integration definitions (recreate connections/secrets on Prod)',
  'IT Asset': 'Asset categories and sync mappings (no inventory or discovery data)',
  'SQL Builder': 'Saved SQL query definitions',
};

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

export function listModules(): {
  module: PromotionModule;
  objectTypes: PromotableObjectType[];
  description: string;
}[] {
  const map = new Map<PromotionModule, PromotableObjectType[]>();
  for (const e of PROMOTABLE_REGISTRY) {
    const list = map.get(e.module) || [];
    list.push(e.objectType);
    map.set(e.module, list);
  }
  return Array.from(map.entries()).map(([module, objectTypes]) => ({
    module,
    objectTypes,
    description: MODULE_DESCRIPTIONS[module] || `Promotable: ${objectTypes.join(', ')}`,
  }));
}

export function isRegisteredPromotable(objectType: string): objectType is PromotableObjectType {
  return !!getRegistryEntry(objectType);
}
