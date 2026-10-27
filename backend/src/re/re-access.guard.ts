import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { getReAccessState } from './re-access';

/**
 * Blocks /api/re/* (except availability) when RE_LEADGEN_ENABLED is off.
 */
@Injectable()
export class ReLeadgenAccessGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    const state = getReAccessState();
    if (!state.enabled) {
      throw new ForbiddenException(state.reason);
    }
    return true;
  }
}
