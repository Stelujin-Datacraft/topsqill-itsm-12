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
import { Public } from '../common/decorators/public.decorator';
import { ReLeadgenAccessGuard } from './re-access.guard';
import {
  ReCreateLeadDto,
  ReCreateListingDto,
  ReCreateProfileDto,
  ReService,
  ReUpdateLeadDto,
  ReUpdateListingDto,
  ReUpdateProfileDto,
} from './re.service';

type AuthedRequest = Request & { user?: { id: string } };

@Controller('re')
export class ReController {
  constructor(private readonly reService: ReService) {}

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
  @Get('assignees')
  listAssignees(@Query('organizationId') organizationId: string) {
    return this.reService.listAssignees(organizationId);
  }

  // Leads
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
  @Patch('leads/:id')
  updateLead(
    @Param('id') id: string,
    @Body() body: ReUpdateLeadDto,
    @Req() req: AuthedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Not authenticated');
    return this.reService.updateLead(id, body, userId);
  }

  @UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
  @Get('leads/:id/activities')
  listLeadActivities(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.reService.listLeadActivities(id, organizationId, limit ? Number(limit) : 50);
  }

  @UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
  @Post('leads/:id/notes')
  addLeadNote(
    @Param('id') id: string,
    @Body() body: { organizationId: string; note: string },
    @Req() req: AuthedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Not authenticated');
    return this.reService.addLeadNote(id, body, userId);
  }

  // Profiles
  @UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
  @Get('profiles')
  listProfiles(
    @Query('organizationId') organizationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.reService.listProfiles(organizationId, limit ? Number(limit) : 50);
  }

  @UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
  @Post('profiles')
  createProfile(@Body() body: ReCreateProfileDto) {
    return this.reService.createProfile(body);
  }

  @UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
  @Patch('profiles/:id')
  updateProfile(@Param('id') id: string, @Body() body: ReUpdateProfileDto) {
    return this.reService.updateProfile(id, body);
  }

  // Listings
  @UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
  @Get('listings')
  listListings(
    @Query('organizationId') organizationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.reService.listListings(organizationId, limit ? Number(limit) : 50);
  }

  @UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
  @Post('listings')
  createListing(@Body() body: ReCreateListingDto) {
    return this.reService.createListing(body);
  }

  @UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
  @Patch('listings/:id')
  updateListing(@Param('id') id: string, @Body() body: ReUpdateListingDto) {
    return this.reService.updateListing(id, body);
  }
}
