import { Injectable } from '@nestjs/common';
import { EngineHostService } from '../engines/engine-host.service';

@Injectable()
export class UsersService {
  constructor(private readonly engineHost: EngineHostService) {}

  async deleteUser(userId: string) {
    return this.engineHost.deleteUser({ userId });
  }

  async adminChangePassword(userId: string, newPassword: string) {
    return this.engineHost.adminChangePassword({ userId, newPassword });
  }

  async sendPasswordReset(email: string, redirectUrl?: string, origin?: string) {
    return this.engineHost.sendPasswordReset({ email, redirectUrl, origin });
  }
}
