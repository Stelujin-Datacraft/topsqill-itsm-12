import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import {
  isMisconfiguredServiceRoleKey,
  misconfiguredServiceRoleMessage,
  parseSupabaseApiKeyRole,
} from './supabase-key-role';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class SupabaseService {
  private readonly serviceClient: SupabaseClient;
  private readonly anonClient: SupabaseClient;
  private readonly supabaseUrl: string;
  private readonly anonKey: string;
  /** False when SUPABASE_SERVICE_ROLE_KEY JWT role is not service_role. */
  private readonly serviceRoleKeyValid: boolean;
  private readonly serviceRoleKeyRole: string | null;

  private readonly userClientCache = new Map<string, CacheEntry<SupabaseClient>>();
  private readonly userTokenCache = new Map<string, CacheEntry<User>>();

  private static readonly CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
  private static readonly TOKEN_CACHE_TTL_MS = 60 * 1000;
  private static readonly MAX_CLIENT_CACHE_SIZE = 500;
  private static readonly MAX_TOKEN_CACHE_SIZE = 2000;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const serviceKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    const configuredAnon = this.configService.get<string>('SUPABASE_ANON_KEY');
    // Never fall back to a mislabeled service key for the anon/apikey slot used with user JWTs.
    this.anonKey = configuredAnon?.trim() || serviceKey;

    const parsed = parseSupabaseApiKeyRole(serviceKey);
    this.serviceRoleKeyRole = parsed.role;
    this.serviceRoleKeyValid = !isMisconfiguredServiceRoleKey(serviceKey);

    if (isMisconfiguredServiceRoleKey(serviceKey)) {
      const msg = misconfiguredServiceRoleMessage(parsed.role || 'unknown');
      console.error(`[SupabaseService] ${msg}`);
      // Deployed Dev/Prod VMs: fail closed so operators fix credentials instead of
      // silently running with anon. Local placeholders (non-JWT) skip this throw.
      const environment = (
        this.configService.get<string>('ENVIRONMENT')
        || this.configService.get<string>('NODE_ENV')
        || ''
      ).toLowerCase();
      if (environment === 'development' || environment === 'production') {
        throw new Error(`[SupabaseService] ${msg}`);
      }
    } else if (!configuredAnon?.trim()) {
      console.warn(
        '[SupabaseService] SUPABASE_ANON_KEY is unset; user-scoped clients fall back to SUPABASE_SERVICE_ROLE_KEY. '
          + 'Set SUPABASE_ANON_KEY (publishable) on Dev and Prod VMs.',
      );
    }

    this.serviceClient = createClient(this.supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    this.anonClient = createClient(this.supabaseUrl, this.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /** Whether SUPABASE_SERVICE_ROLE_KEY decoded as role=service_role (or was non-JWT). */
  isServiceRoleKeyValid(): boolean {
    return this.serviceRoleKeyValid;
  }

  getServiceRoleKeyRole(): string | null {
    return this.serviceRoleKeyRole;
  }

  getServiceClient(): SupabaseClient {
    if (!this.serviceRoleKeyValid) {
      throw new Error(
        misconfiguredServiceRoleMessage(this.serviceRoleKeyRole || 'unknown'),
      );
    }
    return this.serviceClient;
  }

  getAnonClient(): SupabaseClient {
    return this.anonClient;
  }

  getUrl(): string {
    return this.supabaseUrl;
  }

  /**
   * User-scoped PostgREST client. Interactive CRUD must pass a Bearer access token
   * so RLS sees auth.uid(). Do not call without auth and expect service role.
   */
  getClientForUser(authHeader?: string): SupabaseClient {
    if (!authHeader) {
      throw new Error(
        'getClientForUser requires an Authorization bearer (user JWT). '
          + 'Interactive CRUD must not fall back to the service-role client.',
      );
    }

    const cacheKey = this.hashKey(authHeader);
    const cached = this.userClientCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const client = createClient(this.supabaseUrl, this.anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    this.setCacheEntry(
      this.userClientCache,
      cacheKey,
      client,
      SupabaseService.CLIENT_CACHE_TTL_MS,
      SupabaseService.MAX_CLIENT_CACHE_SIZE,
    );

    return client;
  }

  async getUserFromToken(authHeader?: string): Promise<User | null> {
    if (!authHeader) return null;

    const cached = this.userTokenCache.get(authHeader);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const client = this.getClientForUser(authHeader);
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;

    this.setCacheEntry(
      this.userTokenCache,
      authHeader,
      user,
      SupabaseService.TOKEN_CACHE_TTL_MS,
      SupabaseService.MAX_TOKEN_CACHE_SIZE,
    );

    return user;
  }

  private hashKey(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private setCacheEntry<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    value: T,
    ttlMs: number,
    maxSize: number,
  ): void {
    if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}
