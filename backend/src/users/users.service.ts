import { Injectable, BadRequestException } from '@nestjs/common';
import { EngineHostService } from '../engines/engine-host.service';

@Injectable()
export class UsersService {
  constructor(private readonly engineHost: EngineHostService) {}

  async deleteUser(userId: string) {
    const result = await this.engineHost.deleteUser({ userId }) as { success?: boolean; error?: string; message?: string };
    if (!result?.success) {
      throw new BadRequestException(result?.error || 'Failed to delete user');
    }
    return result;
  }

  async adminChangePassword(userId: string, newPassword: string) {
    return this.engineHost.adminChangePassword({ userId, newPassword });
  }

  async sendPasswordReset(email: string, redirectUrl?: string, origin?: string) {
    return this.engineHost.sendPasswordReset({ email, redirectUrl, origin });
  }
}
