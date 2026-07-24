import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('accept-invitation')
  acceptInvitation(@Body() body: { token: string }) {
    return this.authService.acceptInvitation(body.token);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('send-welcome-email')
  sendWelcomeEmail(@Body() body: Record<string, unknown>) {
    return this.authService.sendWelcomeEmail(body);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('send-user-invitation')
  sendUserInvitation(@Body() body: Record<string, unknown>) {
    return this.authService.sendUserInvitation(body);
  }
}
