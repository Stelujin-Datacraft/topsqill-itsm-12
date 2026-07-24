import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@supabase/supabase-js';

@Controller('sessions')
@UseGuards(SupabaseAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('terminate')
  terminate(
    @Body() body: { sessionId: string; targetUserId?: string },
    @CurrentUser() user: User,
  ) {
    return this.sessionsService.terminateSession(body.sessionId, user);
  }
}
