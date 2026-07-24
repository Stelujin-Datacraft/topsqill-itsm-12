import { Injectable } from '@nestjs/common';
import { EngineHostService } from '../engines/engine-host.service';

@Injectable()
export class AuthService {
  constructor(private readonly engineHost: EngineHostService) {}

  async acceptInvitation(token: string) {
    return this.engineHost.acceptUserInvitation({ token });
  }

  async sendWelcomeEmail(body: Record<string, unknown>) {
    return this.engineHost.sendWelcomeEmail(body);
  }

  async sendUserInvitation(body: Record<string, unknown>) {
    return this.engineHost.sendUserInvitation(body);
  }
}
