import { Injectable, BadRequestException } from '@nestjs/common';
import { EngineHostService } from '../engines/engine-host.service';

@Injectable()
export class UsersService {
  constructor(private readonly engineHost: EngineHostService) {}

  private authHeaders(authHeader?: string): Record<string, string | string[] | undefined> {
    return authHeader ? { Authorization: authHeader } : {};
  }

  async deleteUser(userId: string, authHeader?: string) {
    const result = await this.engineHost.deleteUser(
      { userId },
      this.authHeaders(authHeader),
    ) as { success?: boolean; error?: string; message?: string };
    if (!result?.success) {
      throw new BadRequestException(result?.error || 'Failed to delete user');
    }
    return result;
  }

  async adminChangePassword(userId: string, newPassword: string, authHeader?: string) {
    return this.engineHost.adminChangePassword(
      { userId, newPassword },
      this.authHeaders(authHeader),
    );
  }

  async sendPasswordReset(email: string, redirectUrl?: string, origin?: string) {
    return this.engineHost.sendPasswordReset({ email, redirectUrl, origin });
  }
}
