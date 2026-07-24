import { Controller, Post } from '@nestjs/common';
import { SlaService } from './sla.service';
import { Public } from '../common/decorators/public.decorator';
import { UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';

@Controller('sla')
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('predict-breach')
  predictBreach() {
    return this.slaService.predictBreach();
  }

  @Public()
  @Post('process-escalations')
  processEscalations() {
    return this.slaService.processEscalations();
  }
}
