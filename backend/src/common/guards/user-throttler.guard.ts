import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { SupabaseService } from '../../supabase/supabase.service';

export const DEFAULT_THROTTLE_TTL_MS = 60_000;
// The browser routes every table read and write through /api/database, so one
// screen can issue dozens of requests; this is a per-user budget, not per-site.
export const DEFAULT_THROTTLE_LIMIT = 1200;
// Docker/Kubernetes put nginx on a private network in front of Nest; trusting
// only private hops keeps X-Forwarded-For from being spoofed by clients.
export const DEFAULT_TRUST_PROXY = 'loopback, linklocal, uniquelocal';

function positiveInt(raw: unknown, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function throttleSettings(get: (key: string) => unknown) {
  return {
    ttl: positiveInt(get('THROTTLE_TTL_MS'), DEFAULT_THROTTLE_TTL_MS),
    limit: positiveInt(get('THROTTLE_LIMIT'), DEFAULT_THROTTLE_LIMIT),
  };
}

export function trustProxySetting(raw: unknown): boolean | number | string {
  const value = String(raw ?? '').trim();
  if (!value) return DEFAULT_TRUST_PROXY;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export function throttleTracker(req: Record<string, any>, verifiedUserId?: string | null): string {
  if (verifiedUserId) return `user:${verifiedUserId}`;
  return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

/**
 * Rate-limits each signed-in user separately and everyone else by client IP.
 * Only tokens Nest has already verified (cached) get a per-user bucket, so a
 * forged token cannot buy a fresh budget.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    @Inject(Reflector) reflector: Reflector,
    @Inject(SupabaseService) private readonly supabaseService: SupabaseService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const authHeader = req.headers?.authorization;
    return throttleTracker(req, this.supabaseService.getCachedUserForToken(authHeader)?.id);
  }
}
