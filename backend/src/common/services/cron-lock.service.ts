import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class CronLockService {
  private readonly logger = new Logger(CronLockService.name);
  private readonly localLocks = new Set<string>();

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Try to acquire a cron job lock. Uses in-process lock + optional Postgres advisory lock.
   */
  async tryAcquire(jobName: string): Promise<boolean> {
    if (this.localLocks.has(jobName)) {
      return false;
    }

    const supabase = this.supabaseService.getServiceClient();
    const lockKey = this.hashJobName(jobName);

    const { data, error } = await supabase.rpc('try_cron_advisory_lock', { lock_key: lockKey });

    if (error) {
      this.logger.warn(`Advisory lock RPC unavailable for ${jobName}, using in-process lock only`);
    } else if (data === false) {
      return false;
    }

    this.localLocks.add(jobName);
    return true;
  }

  async release(jobName: string): Promise<void> {
    this.localLocks.delete(jobName);
    const supabase = this.supabaseService.getServiceClient();
    const lockKey = this.hashJobName(jobName);
    try {
      await supabase.rpc('release_cron_advisory_lock', { lock_key: lockKey });
    } catch {
      // Advisory unlock is best-effort
    }
  }

  private hashJobName(jobName: string): number {
    let hash = 0;
    for (let i = 0; i < jobName.length; i += 1) {
      hash = (hash * 31 + jobName.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }
}
