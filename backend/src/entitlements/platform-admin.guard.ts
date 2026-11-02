import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

/** Vendor team only (rows in public.platform_admins), never customer org admins. */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(@Inject(EntitlementsService) private readonly entitlements: EntitlementsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userId: string | undefined = context.switchToHttp().getRequest().user?.id;
    if (userId && (await this.entitlements.isPlatformAdmin(userId))) return true;
    throw new ForbiddenException('Only platform administrators can manage subscriptions');
  }
}
