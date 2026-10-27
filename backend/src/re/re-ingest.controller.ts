import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ReLeadgenAccessGuard } from './re-access.guard';
import { ReIngestService } from './re-ingest.service';

/**
 * Public webhook endpoints for lead sources.
 * Auth is via path token + ingest key / verify token — not user JWT.
 */
@Controller('re/ingest')
export class ReIngestController {
  constructor(private readonly ingest: ReIngestService) {}

  @Public()
  @Post('website/:pathToken')
  website(
    @Param('pathToken') pathToken: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-re-ingest-key') headerKey?: string,
    @Query('key') queryKey?: string,
  ) {
    return this.ingest.ingestWebsite(pathToken, headerKey || queryKey, body || {});
  }

  @Public()
  @Get('meta/:pathToken')
  async metaVerify(
    @Param('pathToken') pathToken: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const result = await this.ingest.verifyMeta(pathToken, mode, verifyToken, challenge);
    return res.status(200).send(result.challenge);
  }

  @Public()
  @Post('meta/:pathToken')
  metaLead(@Param('pathToken') pathToken: string, @Body() body: Record<string, unknown>) {
    return this.ingest.ingestMeta(pathToken, body || {});
  }

  @Public()
  @Post('google_ads/:pathToken')
  google(
    @Param('pathToken') pathToken: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-re-ingest-key') headerKey?: string,
    @Query('key') queryKey?: string,
  ) {
    return this.ingest.ingestGoogle(pathToken, headerKey || queryKey, body || {});
  }

  @Public()
  @Post('linkedin/:pathToken')
  linkedin(
    @Param('pathToken') pathToken: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-re-ingest-key') headerKey?: string,
    @Query('key') queryKey?: string,
  ) {
    return this.ingest.ingestLinkedIn(pathToken, headerKey || queryKey, body || {});
  }

  @Public()
  @Post('portal/:pathToken')
  portal(
    @Param('pathToken') pathToken: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-re-ingest-key') headerKey?: string,
    @Query('key') queryKey?: string,
  ) {
    return this.ingest.ingestPortal(pathToken, headerKey || queryKey, body || {});
  }

  /** Alias paths matching provider names used in UI webhook hints */
  @Public()
  @Post('portal_99acres/:pathToken')
  portal99(
    @Param('pathToken') pathToken: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-re-ingest-key') key?: string,
    @Query('key') q?: string,
  ) {
    return this.ingest.ingestPortal(pathToken, key || q, body || {});
  }

  @Public()
  @Post('portal_magicbricks/:pathToken')
  portalMb(
    @Param('pathToken') pathToken: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-re-ingest-key') key?: string,
    @Query('key') q?: string,
  ) {
    return this.ingest.ingestPortal(pathToken, key || q, body || {});
  }

  @Public()
  @Post('portal_housing/:pathToken')
  portalHousing(
    @Param('pathToken') pathToken: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-re-ingest-key') key?: string,
    @Query('key') q?: string,
  ) {
    return this.ingest.ingestPortal(pathToken, key || q, body || {});
  }

  @Public()
  @Post('portal_email/:pathToken')
  portalEmail(
    @Param('pathToken') pathToken: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-re-ingest-key') key?: string,
    @Query('key') q?: string,
  ) {
    return this.ingest.ingestPortal(pathToken, key || q, body || {});
  }

  @Public()
  @Post('call/:pathToken')
  call(
    @Param('pathToken') pathToken: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-re-ingest-key') key?: string,
    @Query('key') q?: string,
  ) {
    return this.ingest.ingestCall(pathToken, key || q, body || {});
  }

  @UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
  @Post('test')
  test(
    @Body()
    body: { organizationId: string; provider: string; sample?: Record<string, unknown> },
  ) {
    return this.ingest.testIngest(body.organizationId, body.provider, body.sample);
  }
}
