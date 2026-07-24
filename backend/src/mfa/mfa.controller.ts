import { Controller, Post, Body } from '@nestjs/common';
import { MfaService } from './mfa.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Public()
  @Post('send-code')
  sendCode(@Body() body: { email: string; userId: string }) {
    return this.mfaService.sendCode(body.email, body.userId);
  }

  @Public()
  @Post('verify-code')
  verifyCode(@Body() body: { userId: string; code: string }) {
    return this.mfaService.verifyCode(body.userId, body.code);
  }
}
