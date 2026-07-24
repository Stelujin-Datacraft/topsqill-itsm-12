import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';

@Controller('ai')
@UseGuards(SupabaseAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('assistant')
  assistant(@Body() body: Record<string, unknown>) {
    return this.aiService.assistant(body);
  }

  @Post('copilot-action')
  copilotAction(@Body() body: Record<string, unknown>) {
    return this.aiService.copilotAction(body);
  }
}
