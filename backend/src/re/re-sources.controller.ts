import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ReLeadgenAccessGuard } from './re-access.guard';
import { ReIngestService } from './re-ingest.service';
import { ReFollowupService } from './re-followup.service';
import { ReMetaEnrichService } from './re-meta-enrich.service';
import { ReDedupeService } from './re-dedupe.service';

type AuthedRequest = Request & { user?: { id: string } };

@Controller('re')
@UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
export class ReSourcesController {
  constructor(
    private readonly ingest: ReIngestService,
    private readonly followups: ReFollowupService,
    private readonly metaEnrich: ReMetaEnrichService,
    private readonly dedupe: ReDedupeService,
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
      appSecret?: string;
      pageId?: string | null;
      formIdExternal?: string | null;
      graphApiVersion?: string;
      fieldMappings?: Record<string, string>;
      settings?: Record<string, unknown>;
      rotateIngestKey?: boolean;
      clearNeedsReauth?: boolean;
    },
  ) {
    const { organizationId, provider, ...patch } = body;
    return this.ingest.updateSourceConfig(organizationId, provider, patch);
  }

  @Post('sources/meta/field-mappings')
  metaMappings(
    @Body() body: { organizationId: string; fieldMappings: Record<string, string> },
  ) {
    return this.metaEnrich.updateFieldMappings(body.organizationId, body.fieldMappings || {});
  }

  @Post('sources/meta/fetch-missed')
  fetchMissed(
    @Body()
    body: {
      organizationId: string;
      formId?: string;
      since?: string;
      until?: string;
      maxPages?: number;
    },
  ) {
    return this.metaEnrich.fetchMissedLeads(body);
  }

  @Post('enrichment/process')
  processEnrichment() {
    return this.metaEnrich.processDueJobs(50);
  }

  @Get('org-settings')
  async orgSettings(@Query('organizationId') organizationId: string) {
    const settings = await this.dedupe.getOrgSettings(organizationId);
    return { settings };
  }

  @Patch('org-settings')
  upsertOrgSettings(
    @Body()
    body: {
      organizationId: string;
      defaultCountryCode?: string;
      dedupeWindowDays?: number;
    },
  ) {
    return this.dedupe.upsertOrgSettings(body.organizationId, body);
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

  @Get('leads/:id/possible-duplicates')
  possibleDuplicates(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.dedupe.possibleDuplicates(organizationId, id);
  }

  @Post('leads/merge')
  merge(
    @Body()
    body: { organizationId: string; survivorLeadId: string; mergedLeadId: string },
    @Req() req: AuthedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Not authenticated');
    return this.dedupe.mergeLeads({ ...body, mergedBy: userId });
  }
}
