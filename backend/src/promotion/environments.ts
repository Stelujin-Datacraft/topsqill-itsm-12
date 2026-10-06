import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient as createSupabaseClient, SupabaseClient as SbClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

export interface PromotionEnvironmentInfo {
  key: string;
  label: string;
  role: 'source' | 'target';
  dualDbConfigured: boolean;
  transferMode: 'dual_supabase' | 'logical_snapshot';
}

@Injectable()
export class PromotionEnvironmentService {
  private readonly logger = new Logger(PromotionEnvironmentService.name);
  private prodClient: SbClient | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  getSourceKey(): string {
    return this.config.get<string>('PROMOTION_SOURCE_KEY', 'TopsqillITSM_Dev');
  }

  getTargetKey(): string {
    return this.config.get<string>('PROMOTION_TARGET_KEY', 'TopsqillITSM_Prod');
  }

  isDualDb(): boolean {
    const url = this.config.get<string>('PROMOTION_PROD_SUPABASE_URL');
    const key = this.config.get<string>('PROMOTION_PROD_SUPABASE_SERVICE_ROLE_KEY');
    return !!(url && key);
  }

  getEnvironments(): PromotionEnvironmentInfo[] {
    const dual = this.isDualDb();
    return [
      {
        key: this.getSourceKey(),
        label: this.getSourceKey(),
        role: 'source',
        dualDbConfigured: dual,
        transferMode: dual ? 'dual_supabase' : 'logical_snapshot',
      },
      {
        key: this.getTargetKey(),
        label: this.getTargetKey(),
        role: 'target',
        dualDbConfigured: dual,
        transferMode: dual ? 'dual_supabase' : 'logical_snapshot',
      },
    ];
  }

  /** Dev / current environment — always the primary Supabase service client. */
  getSourceClient(): SbClient {
    return this.supabase.getServiceClient();
  }

  /**
   * Prod client when dual-DB is configured; otherwise returns source client
   * and callers must use promotion_target_snapshots for logical Prod state.
   */
  getTargetClient(): SbClient {
    if (!this.isDualDb()) {
      return this.supabase.getServiceClient();
    }
    if (!this.prodClient) {
      const url = this.config.getOrThrow<string>('PROMOTION_PROD_SUPABASE_URL');
      const key = this.config.getOrThrow<string>('PROMOTION_PROD_SUPABASE_SERVICE_ROLE_KEY');
      this.prodClient = createSupabaseClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      this.logger.log('Promotion Prod dual-DB client initialized');
    }
    return this.prodClient;
  }

  getTargetOrganizationId(): string | null {
    return this.config.get<string>('PROMOTION_PROD_ORG_ID') || null;
  }

  getProjectMap(): Record<string, string> {
    const raw = this.config.get<string>('PROMOTION_PROD_PROJECT_MAP', '{}');
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      this.logger.warn('Invalid PROMOTION_PROD_PROJECT_MAP JSON; using empty map');
      return {};
    }
  }

  remapProjectId(devProjectId: string | null | undefined): string | null {
    if (!devProjectId) return null;
    const map = this.getProjectMap();
    return map[devProjectId] || (this.isDualDb() ? null : devProjectId);
  }
}
