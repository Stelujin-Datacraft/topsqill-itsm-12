import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';

@Controller('performance')
@UseGuards(SupabaseAuthGuard)
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Post('analyze')
  analyze(@Body() body: Record<string, unknown>) {
    return this.performanceService.analyze(body);
  }
}
