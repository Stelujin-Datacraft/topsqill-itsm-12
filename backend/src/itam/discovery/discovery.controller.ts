import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ItamDiscoveryService, type ItamPrincipal } from './discovery.service';

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
export class ItamDiscoveryController {
  constructor(private readonly discovery: ItamDiscoveryService) {}

  @Get('discovery/dashboard')
  dashboard(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.discovery.dashboard(principalFrom(req, headers));
  }

  @Get('discovery/metrics')
  metrics(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.discovery.metrics(principalFrom(req, headers));
  }

  @Get('network-scopes')
  listScopes(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.discovery.listScopes(principalFrom(req, headers));
  }

  @Post('network-scopes')
  createScope(@Req() req: any, @Headers() headers: Record<string, string>, @Body() body: any) {
    return this.discovery.createScope(principalFrom(req, headers), body);
  }

  @Post('network-scopes/:id/approve')
  approveScope(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.discovery.approveScope(principalFrom(req, headers), id);
  }

  @Get('discovery/jobs')
  listJobs(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.discovery.listJobs(principalFrom(req, headers));
  }

  @Get('discovery/jobs/:id')
  getJob(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.discovery.getJob(principalFrom(req, headers), id);
  }

  @Post('discovery/jobs')
  createJob(@Req() req: any, @Headers() headers: Record<string, string>, @Body() body: any) {
    return this.discovery.createJob(principalFrom(req, headers), body);
  }

  @Get('discovery/jobs/:id/estimate')
  estimate(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.discovery.estimateJob(principalFrom(req, headers), id);
  }

  @Post('discovery/jobs/:id/validate')
  validate(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.discovery.validateJob(principalFrom(req, headers), id);
  }

  @Post('discovery/jobs/:id/start')
  start(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.discovery.startJob(principalFrom(req, headers), id);
  }

  @Post('discovery/jobs/:id/pause')
  pause(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.discovery.pauseJob(principalFrom(req, headers), id);
  }

  @Post('discovery/jobs/:id/resume')
  resume(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.discovery.resumeJob(principalFrom(req, headers), id);
  }

  @Post('discovery/jobs/:id/cancel')
  cancel(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.discovery.cancelJob(principalFrom(req, headers), id);
  }

  @Get('discovered-assets')
  listDiscovered(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.discovery.listDiscovered(principalFrom(req, headers));
  }

  @Get('discovered-assets/:id')
  getDiscovered(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.discovery.getDiscovered(principalFrom(req, headers), id);
  }

  @Get('assets/:id/software')
  assetSoftware(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
  ) {
    return this.discovery.listSoftware(principalFrom(req, headers), id);
  }

  @Get('software')
  software(@Req() req: any, @Headers() headers: Record<string, string>, @Query('assetId') assetId?: string) {
    return this.discovery.listSoftware(principalFrom(req, headers), assetId);
  }

  @Get('unmanaged-assets')
  unmanaged(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.discovery.listUnmanaged(principalFrom(req, headers));
  }

  @Post('assets/:id/verify')
  verify(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.discovery.verifyAsset(principalFrom(req, headers), id);
  }

  @Post('assets/:id/ignore')
  ignore(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.discovery.ignoreAsset(principalFrom(req, headers), id);
  }

  @Post('assets/:id/approve-agent-onboarding')
  approveAgent(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.discovery.approveAgentOnboarding(principalFrom(req, headers), id);
  }
}
