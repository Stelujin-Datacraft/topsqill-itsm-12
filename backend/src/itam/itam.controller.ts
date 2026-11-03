import { Controller, Post, Body, Headers } from '@nestjs/common';
import { ItamService } from './itam.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('itam')
export class ItamController {
  constructor(private readonly itamService: ItamService) {}

  @Public()
  @Post('agent-report')
  agentReport(@Body() body: Record<string, unknown>, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.itamService.handleAgentReport(body, headers);
  }
}
