import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ItamFormSyncService } from './sync.service';
import type { ItamPrincipal } from '../discovery/discovery.service';

function principalFrom(req: any, headers: Record<string, string | undefined>): ItamPrincipal {
  const user = req?.user || {};
  const organizationId =
    headers['x-organization-id']
    || user.organizationId
    || user.organization_id
    || process.env.ITAM_DEFAULT_ORG_ID;
  const userId = user.id || user.userId || headers['x-user-id'] || 'system';
  const roles = user.roles || (headers['x-itam-roles'] ? String(headers['x-itam-roles']).split(',') : ['ITAM_ADMIN']);
  if (!organizationId) throw new UnauthorizedException('organization context required');
  return { userId: String(userId), organizationId: String(organizationId), roles: roles.map(String) };
}

@Controller('itam')
export class ItamFormSyncController {
  constructor(private readonly sync: ItamFormSyncService) {}

  @Get('sync/targets')
  listTargets(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.sync.listTargets(principalFrom(req, headers));
  }

  @Post('sync/targets')
  createTarget(@Req() req: any, @Headers() headers: Record<string, string>, @Body() body: any) {
    return this.sync.createTarget(principalFrom(req, headers), body);
  }

  @Get('sync/targets/:id/forms')
  discoverForms(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.sync.discoverForms(principalFrom(req, headers), id);
  }

  @Get('sync/schema/:form')
  getSchema(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('form') form: string,
  ) {
    // targetId optional via x-sync-target-id header
    return this.sync.getSchema(principalFrom(req, headers), form, headers['x-sync-target-id']);
  }

  @Get('sync/mappings')
  listMappings(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.sync.listMappings(principalFrom(req, headers));
  }

  @Post('sync/mappings/preview')
  previewMappings(@Req() req: any, @Headers() headers: Record<string, string>, @Body() body: any) {
    return this.sync.previewMappings(principalFrom(req, headers), body);
  }

  @Post('sync/mappings/:id/approve')
  approveMapping(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.sync.approveMapping(principalFrom(req, headers), id);
  }

  @Post('sync/preview')
  preview(@Req() req: any, @Headers() headers: Record<string, string>, @Body() body: any) {
    return this.sync.previewSync(principalFrom(req, headers), body);
  }

  @Post('sync/execute')
  execute(@Req() req: any, @Headers() headers: Record<string, string>, @Body() body: any) {
    return this.sync.executeSync(principalFrom(req, headers), body);
  }

  @Get('sync/runs')
  listRuns(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.sync.listRuns(principalFrom(req, headers));
  }

  @Get('sync/runs/:id')
  getRun(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.sync.getRun(principalFrom(req, headers), id);
  }

  @Get('sync/history/:assetId')
  history(@Req() req: any, @Headers() headers: Record<string, string>, @Param('assetId') assetId: string) {
    return this.sync.history(principalFrom(req, headers), assetId);
  }

  @Get('sync/provenance/:assetId')
  provenance(@Req() req: any, @Headers() headers: Record<string, string>, @Param('assetId') assetId: string) {
    return this.sync.provenance(principalFrom(req, headers), assetId);
  }

  @Get('sync/metrics')
  metrics(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.sync.metrics(principalFrom(req, headers));
  }
}
