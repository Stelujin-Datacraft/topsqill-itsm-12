import { Injectable } from '@nestjs/common';
import { EngineHostService } from '../engines/engine-host.service';

@Injectable()
export class MfaService {
  constructor(private readonly engineHost: EngineHostService) {}

  async sendCode(email: string, userId: string) {
    return this.engineHost.sendMfaCode({ email, userId });
  }

  async verifyCode(userId: string, code: string) {
    return this.engineHost.verifyMfaCode({ userId, code });
  }
}
