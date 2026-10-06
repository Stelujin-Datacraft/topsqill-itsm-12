import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { PromotionService } from './promotion.service';

type AuthedRequest = Request & { user?: { id: string }; authHeader?: string };

@Controller('promotion')
@UseGuards(SupabaseAuthGuard)
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  private userId(req: AuthedRequest): string {
    const id = req.user?.id;
    if (!id) throw new ForbiddenException('Not authenticated');
    return id;
  }

  @Get('dashboard')
  dashboard(@Req() req: AuthedRequest) {
    return this.promotionService.getDashboard(this.userId(req));
  }

  @Get('environments')
  environments(@Req() req: AuthedRequest) {
    return this.promotionService.getEnvironments(this.userId(req));
  }

  @Get('registry')
  registry(@Req() req: AuthedRequest) {
    return this.promotionService.getRegistry(this.userId(req));
  }

  @Get('modules')
  modules(@Req() req: AuthedRequest) {
    return this.promotionService.getModules(this.userId(req));
  }

  @Get('objects')
  objects(
    @Req() req: AuthedRequest,
    @Query('module') module?: string,
    @Query('objectType') objectType?: string,
    @Query('projectId') projectId?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.promotionService.listObjects(this.userId(req), {
      module,
      objectType,
      projectId,
      organizationId,
    });
  }

  @Get('packages')
  packages(@Req() req: AuthedRequest) {
    return this.promotionService.listPackages(this.userId(req));
  }

  @Post('packages')
  create(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      name: string;
      module: string;
      projectId?: string;
      organizationId?: string;
      notes?: string;
    },
  ) {
    return this.promotionService.createPackage(this.userId(req), body);
  }

  @Get('packages/:id')
  getOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.promotionService.getPackage(this.userId(req), id);
  }

  @Put('packages/:id/selection')
  selection(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body()
    body: {
      selections: Array<{ objectType: string; objectId: string; stableId?: string; objectName?: string }>;
    },
  ) {
    return this.promotionService.setSelection(this.userId(req), id, body);
  }

  @Post('packages/:id/dependencies')
  dependencies(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { includeStableIds?: string[] },
  ) {
    return this.promotionService.resolveDependencies(this.userId(req), id, body);
  }

  @Post('packages/:id/validate')
  validate(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.promotionService.validate(this.userId(req), id);
  }

  @Get('packages/:id/summary')
  summary(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.promotionService.getSummary(this.userId(req), id);
  }

  @Post('packages/:id/execute')
  execute(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.promotionService.execute(this.userId(req), id);
  }
}
