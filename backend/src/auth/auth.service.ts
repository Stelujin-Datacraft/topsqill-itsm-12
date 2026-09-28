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

  async requestSignupVerification(body: Record<string, unknown>, origin?: string) {
    return this.engineHost.requestSignupVerification(
      { ...body, origin },
      origin ? { origin } : undefined,
    );
  }

  async verifySignup(body: { token?: string; email?: string; otp?: string }) {
    return this.engineHost.verifySignup(body);
  }

  async requestSigninOtp(body: { email?: string }) {
    return this.engineHost.requestSigninOtp(body);
  }

  async verifySigninOtp(body: { email?: string; otp?: string; code?: string }) {
    return this.engineHost.verifySigninOtp(body);
  }
}
