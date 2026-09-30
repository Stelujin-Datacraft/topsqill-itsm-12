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
import { ItamCloudService } from './cloud.service';
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
export class ItamCloudController {
  constructor(private readonly cloud: ItamCloudService) {}

  @Get('cloud/providers')
  listProviders(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.cloud.listCloudProviders(principalFrom(req, headers));
  }

  @Post('cloud/providers')
  createProvider(@Req() req: any, @Headers() headers: Record<string, string>, @Body() body: any) {
    return this.cloud.createCloudProvider(principalFrom(req, headers), body);
  }

  @Get('cloud/resources')
  listResources(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.cloud.listCloudResources(principalFrom(req, headers));
  }

  @Get('cloud/discovery/jobs')
  listJobs(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.cloud.listCloudJobs(principalFrom(req, headers));
  }

  @Get('cloud/discovery/jobs/:id')
  getJob(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.cloud.getCloudJob(principalFrom(req, headers), id);
  }

  @Post('cloud/discovery/jobs')
  createJob(@Req() req: any, @Headers() headers: Record<string, string>, @Body() body: any) {
    return this.cloud.createCloudJob(principalFrom(req, headers), body);
  }

  @Post('cloud/discovery/jobs/:id/start')
  startJob(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.cloud.startCloudJob(principalFrom(req, headers), id);
  }

  @Post('cloud/discovery/jobs/:id/cancel')
  cancelJob(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.cloud.cancelCloudJob(principalFrom(req, headers), id);
  }

  @Get('vmware/providers')
  listVmware(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.cloud.listVmwareProviders(principalFrom(req, headers));
  }

  @Post('vmware/providers')
  createVmware(@Req() req: any, @Headers() headers: Record<string, string>, @Body() body: any) {
    return this.cloud.createVmwareProvider(principalFrom(req, headers), body);
  }

  @Post('vmware/discovery/jobs')
  createVmwareJob(@Req() req: any, @Headers() headers: Record<string, string>, @Body() body: any) {
    return this.cloud.createCloudJob(principalFrom(req, headers), body);
  }

  @Get('vmware/resources')
  listVmwareResources(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.cloud.listVmwareResources(principalFrom(req, headers));
  }

  @Get('network-intelligence/observations')
  observations(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.cloud.listObservations(principalFrom(req, headers));
  }

  @Post('network-intelligence/sources')
  createSource(@Req() req: any, @Headers() headers: Record<string, string>, @Body() body: any) {
    return this.cloud.createTelemetrySource(principalFrom(req, headers), body);
  }

  @Get('network-intelligence/sources')
  listSources(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.cloud.listTelemetrySources(principalFrom(req, headers));
  }

  @Post('network-intelligence/ingest')
  ingest(@Req() req: any, @Headers() headers: Record<string, string>, @Body() body: any) {
    return this.cloud.ingestObservations(
      principalFrom(req, headers),
      body.sourceType,
      body.observations || [],
      body.sourceId,
    );
  }

  @Get('network-intelligence/ip-history/:assetId')
  ipHistory(@Req() req: any, @Headers() headers: Record<string, string>, @Param('assetId') assetId: string) {
    return this.cloud.ipHistory(principalFrom(req, headers), assetId);
  }

  @Get('network-intelligence/mac-history/:assetId')
  macHistory(@Req() req: any, @Headers() headers: Record<string, string>, @Param('assetId') assetId: string) {
    return this.cloud.macHistory(principalFrom(req, headers), assetId);
  }

  @Get('network-intelligence/dhcp')
  dhcp(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.cloud.listDhcp(principalFrom(req, headers));
  }

  @Get('network-intelligence/dns')
  dns(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.cloud.listDns(principalFrom(req, headers));
  }

  @Get('network-intelligence/switches')
  switches(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.cloud.listSwitches(principalFrom(req, headers));
  }

  @Get('topology')
  topology(@Req() req: any, @Headers() headers: Record<string, string>, @Query() query: Record<string, string>) {
    return this.cloud.topologyGraph(principalFrom(req, headers), {
      includeLowConfidence: query.includeLowConfidence === '1',
      maxNodes: Number(query.maxNodes || 200),
    });
  }

  @Get('topology/summary')
  topologySummary(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.cloud.topologySummary(principalFrom(req, headers));
  }

  @Get('topology/assets/:id')
  topologyAsset(@Req() req: any, @Headers() headers: Record<string, string>, @Param('id') id: string) {
    return this.cloud.topologyForAsset(principalFrom(req, headers), id);
  }

  @Get('topology/neighbors/:id')
  topologyNeighbors(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Query() query: Record<string, string>,
  ) {
    return this.cloud.topologyNeighbors(principalFrom(req, headers), id, query);
  }

  @Get('topology/paths')
  topologyPaths(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Query('from') fromId: string,
    @Query('to') toId: string,
  ) {
    return this.cloud.topologyPath(principalFrom(req, headers), fromId, toId);
  }

  @Get('phases-bd/metrics')
  metrics(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.cloud.metrics(principalFrom(req, headers));
  }
}
