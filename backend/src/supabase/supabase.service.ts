import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { createHash } from 'crypto';

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

  private readonly userClientCache = new Map<string, CacheEntry<SupabaseClient>>();
  private readonly userTokenCache = new Map<string, CacheEntry<User>>();

  private static readonly CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
  private static readonly TOKEN_CACHE_TTL_MS = 60 * 1000;
  private static readonly MAX_CLIENT_CACHE_SIZE = 500;
  private static readonly MAX_TOKEN_CACHE_SIZE = 2000;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const serviceKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.anonKey = this.configService.get<string>('SUPABASE_ANON_KEY', serviceKey);

    // Fail-closed warning: Form API writes require a true service_role JWT.
    // Do not bypass RLS; operators must supply the correct key.
    try {
      const payload = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64url').toString('utf8'));
      if (payload?.role && payload.role !== 'service_role') {
        console.warn(
          `[SupabaseService] SUPABASE_SERVICE_ROLE_KEY JWT role is "${payload.role}" (expected service_role). `
            + 'TopSqill Form API writes will be subject to RLS and likely fail. Environment is READ_ONLY_TEST until corrected.',
        );
      }
    } catch {
      /* non-JWT keys left as-is */
    }

    this.serviceClient = createClient(this.supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    this.anonClient = createClient(this.supabaseUrl, this.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  getServiceClient(): SupabaseClient {
    return this.serviceClient;
  }

  getAnonClient(): SupabaseClient {
    return this.anonClient;
  }

  getUrl(): string {
    return this.supabaseUrl;
  }

  getClientForUser(authHeader?: string): SupabaseClient {
    if (!authHeader) {
      return this.serviceClient;
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
