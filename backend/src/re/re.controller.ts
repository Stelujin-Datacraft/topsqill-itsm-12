import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { ReLeadgenAccessGuard } from './re-access.guard';
import { ReCreateLeadDto, ReService } from './re.service';

type AuthedRequest = Request & { user?: { id: string } };

@Controller('re')
export class ReController {
  constructor(private readonly reService: ReService) {}

  /**
   * Lightweight probe — always reachable (no feature guard) so the UI can
   * decide whether to show Real Estate nav without throwing.
   */
  @Public()
  @Get('availability')
  availability() {
    return this.reService.availabilityWithSchema();
  }

  @UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
  @Get('overview')
  overview(@Query('organizationId') organizationId: string) {
    return this.reService.overview(organizationId);
  }

  @UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
  @Get('leads')
  listLeads(
    @Query('organizationId') organizationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.reService.listLeads(organizationId, limit ? Number(limit) : 50);
  }

  @UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
  @Post('leads')
  createLead(@Body() body: ReCreateLeadDto, @Req() req: AuthedRequest) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Not authenticated');
    return this.reService.createLead(body, userId);
  }

  @UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
  @Get('profiles')
  listProfiles(
    @Query('organizationId') organizationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.reService.listProfiles(organizationId, limit ? Number(limit) : 50);
  }

  @UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
  @Get('listings')
  listListings(
    @Query('organizationId') organizationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.reService.listListings(organizationId, limit ? Number(limit) : 50);
  }
}
