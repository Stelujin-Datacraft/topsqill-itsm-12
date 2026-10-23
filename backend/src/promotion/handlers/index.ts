import { FormHandler } from './form.handler';
import { WorkflowHandler } from './workflow.handler';
import { ReportHandler, DashboardHandler, EmailTemplateHandler } from './report.handler';
import { RoleHandler, OrgUserHandler, GroupHandler } from './access-control.handler';
import { DataFeedHandler } from './data-feed.handler';
import { KbFolderHandler, PolicyHandler } from './knowledge-base.handler';
import { VisIntegrationHandler } from './vis.handler';
import { AssetCategoryHandler, ItamSyncMappingHandler } from './itam.handler';
import { SavedQueryHandler } from './sql-builder.handler';
import type { PromotableHandler } from './handler.types';
import type { PromotableObjectType } from '../registry/types';
import { assertPromotable } from '../registry/promotable-registry';

const handlers: PromotableHandler[] = [
  new FormHandler(),
  new WorkflowHandler(),
  new ReportHandler(),
  new DashboardHandler(),
  new EmailTemplateHandler(),
  new OrgUserHandler(),
  new RoleHandler(),
  new GroupHandler(),
  new DataFeedHandler(),
  new KbFolderHandler(),
  new PolicyHandler(),
  new VisIntegrationHandler(),
  new AssetCategoryHandler(),
  new ItamSyncMappingHandler(),
  new SavedQueryHandler(),
];

const byType = new Map<PromotableObjectType, PromotableHandler>(
  handlers.map((h) => [h.objectType, h]),
);

export function getHandler(objectType: string): PromotableHandler {
  assertPromotable(objectType);
  const h = byType.get(objectType as PromotableObjectType);
  if (!h) throw new Error(`No transfer handler for promotable type "${objectType}"`);
  return h;
}

export function listHandlers(): PromotableHandler[] {
  return handlers;
}
