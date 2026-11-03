import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { EntitlementsService } from './entitlements.service';
import { needForMethod } from './module-catalog';
import { REQUIRES_MODULE_KEY, type RequiresModuleMetadata } from './requires-module.decorator';

/**
 * Runs after SupabaseAuthGuard. Routes marked @RequiresModule are only reachable when the
 * caller's organisation (from user_profiles, never from a request header) has the module.
 */
@Injectable()
export class ModuleEntitlementGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(EntitlementsService) private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<RequiresModuleMetadata | undefined>(REQUIRES_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;
    if (!userId) {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
      if (isPublic) return true;
      throw new UnauthorizedException('Sign in required');
    }

    const organizationId = await this.entitlements.getOrgIdForUser(userId);
    if (!organizationId) throw new ForbiddenException('Your account is not linked to an organisation');

    const need = meta.need ?? needForMethod(request.method);
    await this.entitlements.assertModule(organizationId, meta.module, need, userId);
    if (meta.consume) await this.entitlements.consume(organizationId, meta.module, meta.consume, 1, userId);
    request.entitlementOrgId = organizationId;
    return true;
  }
}
