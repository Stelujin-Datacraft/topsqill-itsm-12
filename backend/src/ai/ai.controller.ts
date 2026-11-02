import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';

@RequiresModule('ai-builder', { need: 'use', consume: 'ai_requests' })
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
