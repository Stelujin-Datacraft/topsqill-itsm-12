import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../../supabase/supabase.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header');
    }

    const user = await this.supabaseService.getUserFromToken(authHeader);
    if (!user) {
      // Common VM misconfig: frontend VITE_SUPABASE_URL project ≠ Nest SUPABASE_URL.
      // That 401s every /database mutation and looks like “all modules cannot create/delete”.
      throw new UnauthorizedException(
        'Invalid user token (JWT not accepted by Nest SUPABASE_URL — check frontend and backend use the same Supabase project)',
      );
    }

    request.user = user;
    request.authHeader = authHeader;
    return true;
  }
}
