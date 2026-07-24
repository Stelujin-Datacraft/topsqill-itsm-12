import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly serviceClient: SupabaseClient;
  private readonly anonClient: SupabaseClient;
  private readonly supabaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const serviceKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = this.configService.get<string>('SUPABASE_ANON_KEY', serviceKey);

    this.serviceClient = createClient(this.supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    this.anonClient = createClient(this.supabaseUrl, anonKey, {
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
    const anonKey = this.configService.get<string>('SUPABASE_ANON_KEY', '');
    return createClient(this.supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async getUserFromToken(authHeader?: string): Promise<User | null> {
    if (!authHeader) return null;
    const client = this.getClientForUser(authHeader);
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;
    return user;
  }
}
