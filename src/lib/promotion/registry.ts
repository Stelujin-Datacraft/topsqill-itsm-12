/**
 * Client-side Promotable Object Registry mirror.
 * Must stay aligned with backend/src/promotion/registry/promotable-registry.ts.
 * Used so the Create Promotion wizard can show modules even when Nest is briefly unreachable.
 */

export type PromotionModuleName =
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

export const PROMOTION_MODULES: Array<{
  module: PromotionModuleName;
  objectTypes: string[];
  description: string;
}> = [
  {
    module: 'Forms',
    objectTypes: ['form'],
    description: 'Form definitions, layouts, and field configuration',
  },
  {
    module: 'Workflows',
    objectTypes: ['workflow'],
    description: 'Workflow graphs, nodes, and connections',
  },
  {
    module: 'Reports',
    objectTypes: ['report', 'dashboard'],
    description: 'Report definitions and dashboard layouts',
  },
  {
    module: 'Notifications',
    objectTypes: ['email_template'],
    description: 'Email / notification templates',
  },
  {
    module: 'Access Control',
    objectTypes: ['role'],
    description: 'Role definitions and type-wide permissions (no user assignments)',
  },
  {
    module: 'Data Feed',
    objectTypes: ['data_feed'],
    description: 'Data feed definitions and field mappings (no run history)',
  },
  {
    module: 'Knowledge Base',
    objectTypes: ['kb_folder', 'policy'],
    description: 'Folders and policy/audit documents',
  },
  {
    module: 'Integration Studio',
    objectTypes: ['vis_integration'],
    description: 'VIS integration definitions (recreate connections/secrets on Prod)',
  },
  {
    module: 'IT Asset',
    objectTypes: ['asset_category', 'itam_sync_mapping'],
    description: 'Asset categories and sync mappings (no inventory or discovery data)',
  },
  {
    module: 'SQL Builder',
    objectTypes: ['saved_query'],
    description: 'Saved SQL query definitions',
  },
];

export const DEFAULT_PROMOTION_ENVIRONMENTS = {
  source: 'TopsqillITSM_Dev',
  target: 'TopsqillITSM_Prod',
  supportedFlow: 'Dev → Prod',
};
