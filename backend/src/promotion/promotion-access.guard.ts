import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { assertPromotionalTransferAllowed, getPromotionAccessState } from './promotion-access';

/**
 * Rejects all Promotional Transfer API traffic when this deployment is Production
 * or when PROMOTIONAL_TRANSFER_ENABLED is false.
 * Applied at controller level — menu hiding alone is not sufficient.
 */
@Injectable()
export class PromotionalTransferEnabledGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    try {
      assertPromotionalTransferAllowed(process.env);
      return true;
    } catch (e: any) {
      throw new ForbiddenException(e?.message || 'Promotional Transfer is not available');
    }
  }
}

@Injectable()
export class PromotionAvailabilityService {
  getAvailability() {
    return getPromotionAccessState(process.env);
  }
}
