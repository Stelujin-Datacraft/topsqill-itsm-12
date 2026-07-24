import { Controller, Post, Body } from '@nestjs/common';
import { ItamService } from './itam.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('itam')
export class ItamController {
  constructor(private readonly itamService: ItamService) {}

  @Public()
  @Post('agent-report')
  agentReport(@Body() body: Record<string, unknown>) {
    return this.itamService.handleAgentReport(body);
  }
}
