import { Controller, Post, Body, UseGuards, Headers, Req } from '@nestjs/common';
import { Request } from 'express';
import { EngineHostService } from '../engines/engine-host.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';

@Controller('email')
export class EmailController {
  constructor(private readonly engineHost: EngineHostService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('test-smtp-connection')
  testSmtpConnection(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.engineHost.testSmtpConnection(body, req.headers as Record<string, string | string[] | undefined>);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('send-template')
  sendTemplateEmail(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.engineHost.sendTemplateEmail(body, req.headers as Record<string, string | string[] | undefined>);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('send-delegation')
  sendDelegationEmail(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.engineHost.sendDelegationEmail(body, req.headers as Record<string, string | string[] | undefined>);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('send-kb-notification')
  sendKbNotification(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.engineHost.sendKbNotificationEmail(body, req.headers as Record<string, string | string[] | undefined>);
  }
}
