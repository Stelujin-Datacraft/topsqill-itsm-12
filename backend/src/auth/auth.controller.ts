import { Controller, Post, Body, Headers, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';

type AuthedRequest = Request & { user?: { id: string } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('accept-invitation')
  acceptInvitation(@Body() body: { token: string }) {
    return this.authService.acceptInvitation(body.token);
  }

  @Public()
  @Post('request-signup-verification')
  requestSignupVerification(
    @Body() body: Record<string, unknown>,
    @Headers('origin') origin?: string,
  ) {
    return this.authService.requestSignupVerification(body, origin);
  }

  @Public()
  @Post('verify-signup')
  verifySignup(@Body() body: { token?: string; email?: string; otp?: string }) {
    return this.authService.verifySignup(body);
  }

  @Public()
  @Post('request-signin-otp')
  requestSigninOtp(@Body() body: { email?: string }) {
    return this.authService.requestSigninOtp(body);
  }

  @Public()
  @Post('verify-signin-otp')
  verifySigninOtp(@Body() body: { email?: string; otp?: string; code?: string }) {
    return this.authService.verifySigninOtp(body);
  }

  @Public()
  @Post('check-signup-availability')
  checkSignupAvailability(@Body() body: { email?: string; organization_name?: string }) {
    return this.authService.checkSignupAvailability(body);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('send-welcome-email')
  sendWelcomeEmail(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    return this.authService.sendWelcomeEmail({
      ...body,
      _actorId: req.user?.id,
    });
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('send-user-invitation')
  sendUserInvitation(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    return this.authService.sendUserInvitation({
      ...body,
      _actorId: req.user?.id,
    });
  }
}
