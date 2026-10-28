import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { RegulatoryAccessGuard } from './regulatory-access.guard';
import { RegulatoryService } from './regulatory.service';

type Authed = Request & { user?: { id: string }; authHeader?: string };

@Controller('regulatory')
@UseGuards(SupabaseAuthGuard, RegulatoryAccessGuard)
export class RegulatoryController {
  constructor(private readonly regulatory: RegulatoryService) {}

  @Public()
  @Get('availability')
  availability() {
    return this.regulatory.availability();
  }

  @Post('provision')
  provision(@Req() req: Authed, @Body() body: { projectId?: string }) {
    return this.regulatory.provision(req.authHeader || '', body.projectId || '', req.user?.id || '');
  }

  @Post('import')
  importInstrument(@Req() req: Authed, @Body() body: { projectId?: string; instrument?: string }) {
    return this.regulatory.importInstrument(req.authHeader || '', body.projectId || '', req.user?.id || '', body.instrument || '');
  }

  @Post('quality')
  quality(@Req() req: Authed, @Body() body: { projectId?: string }) {
    return this.regulatory.quality(req.authHeader || '', body.projectId || '', req.user?.id || '');
  }

  @Post('verify-source')
  verify(@Req() req: Authed, @Body() body: { projectId?: string; submissionId?: string; decision?: 'Verified' | 'Rejected'; notes?: string }) {
    return this.regulatory.verifySource(req.authHeader || '', {
      projectId: body.projectId || '',
      userId: req.user?.id || '',
      submissionId: body.submissionId || '',
      decision: body.decision === 'Rejected' ? 'Rejected' : 'Verified',
      notes: body.notes || '',
    });
  }

  @Post('approve-requirement')
  approve(@Req() req: Authed, @Body() body: { projectId?: string; submissionId?: string; notes?: string }) {
    return this.regulatory.approveRequirement(req.authHeader || '', {
      projectId: body.projectId || '',
      userId: req.user?.id || '',
      submissionId: body.submissionId || '',
      notes: body.notes || '',
    });
  }

  @Post('link-policies')
  linkPolicies(@Req() req: Authed, @Body() body: { projectId?: string; submissionId?: string; policyIds?: string[] }) {
    return this.regulatory.linkPolicies(req.authHeader || '', {
      projectId: body.projectId || '',
      userId: req.user?.id || '',
      submissionId: body.submissionId || '',
      policyIds: body.policyIds || [],
    });
  }

  @Post('ai')
  ai(@Req() req: Authed, @Body() body: { projectId?: string; action?: string; submissionId?: string; text?: string; organizationContext?: string }) {
    return this.regulatory.ai(req.authHeader || '', {
      projectId: body.projectId || '',
      userId: req.user?.id || '',
      action: body.action || '',
      submissionId: body.submissionId,
      text: body.text,
      organizationContext: body.organizationContext,
    });
  }
}
