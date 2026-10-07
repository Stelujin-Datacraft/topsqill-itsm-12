/**
 * Client-side Promotable Object Registry mirror.
 * Must stay aligned with backend/src/promotion/registry/promotable-registry.ts.
 * Used so the Create Promotion wizard can show modules even when Nest is briefly unreachable.
 */

export type PromotionModuleName = 'Forms' | 'Workflows' | 'Reports' | 'Notifications';

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
];

export const DEFAULT_PROMOTION_ENVIRONMENTS = {
  source: 'TopsqillITSM_Dev',
  target: 'TopsqillITSM_Prod',
  supportedFlow: 'Dev → Prod',
};
