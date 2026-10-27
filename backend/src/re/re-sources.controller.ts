import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ReLeadgenAccessGuard } from './re-access.guard';
import { ReIngestService } from './re-ingest.service';
import { ReFollowupService } from './re-followup.service';

@Controller('re')
@UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
export class ReSourcesController {
  constructor(
    private readonly ingest: ReIngestService,
    private readonly followups: ReFollowupService,
  ) {}

  @Post('sources/ensure')
  ensure(@Body() body: { organizationId: string; projectId?: string | null }) {
    return this.ingest.ensureSourceConfigs(body.organizationId, body.projectId);
  }

  @Get('sources')
  listSources(@Query('organizationId') organizationId: string) {
    return this.ingest.listSourceConfigs(organizationId);
  }

  @Patch('sources')
  updateSource(
    @Body()
    body: {
      organizationId: string;
      provider: string;
      enabled?: boolean;
      displayName?: string;
      verifyToken?: string;
      accessToken?: string;
      pageId?: string | null;
      formIdExternal?: string | null;
      settings?: Record<string, unknown>;
      rotateIngestKey?: boolean;
    },
  ) {
    const { organizationId, provider, ...patch } = body;
    return this.ingest.updateSourceConfig(organizationId, provider, patch);
  }

  @Get('ingest-events')
  events(
    @Query('organizationId') organizationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.ingest.listIngestEvents(organizationId, limit ? Number(limit) : 50);
  }

  @Get('follow-up-rules')
  rules(@Query('organizationId') organizationId: string) {
    return this.followups.listRules(organizationId);
  }

  @Post('follow-up-rules')
  upsertRule(
    @Body()
    body: {
      organizationId: string;
      id?: string;
      enabled?: boolean;
      name?: string;
      delayMinutes?: number;
      subjectTemplate?: string;
      bodyTemplate?: string;
      onlySources?: string[] | null;
    },
  ) {
    const { organizationId, ...rest } = body;
    return this.followups.upsertRule(organizationId, rest);
  }

  @Get('follow-up-jobs')
  jobs(
    @Query('organizationId') organizationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.followups.listJobs(organizationId, limit ? Number(limit) : 50);
  }

  @Post('follow-up-jobs/process')
  processNow() {
    return this.followups.processDueJobs(50);
  }
}
