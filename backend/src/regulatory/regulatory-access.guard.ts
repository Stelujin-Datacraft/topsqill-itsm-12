import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { getRegulatoryAccessState } from './regulatory-access';

@Injectable()
export class RegulatoryAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request?.route?.path === 'availability' || String(request?.url || '').includes('/availability')) {
      return true;
    }
    const state = getRegulatoryAccessState();
    if (!state.enabled) throw new ForbiddenException(state.reason);
    return true;
  }
}
