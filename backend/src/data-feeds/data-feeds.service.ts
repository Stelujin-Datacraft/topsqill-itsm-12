import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { shouldRunCronSchedule } from '../common/utils/cron-schedule.util';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DataFeedsService {
  private readonly logger = new Logger(DataFeedsService.name);
  private readonly supabaseUrl: string;
  private readonly serviceKey: string;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    this.serviceKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
  }

  async executeFeed(body: { feedId: string; triggeredBy?: string }) {
    const { feedId, triggeredBy } = body;

    try {
      const result = await this.invokeEdgeFunction('execute-data-feed', {
        feedId,
        triggeredBy: triggeredBy || 'api',
      });
      return { success: true, ...result };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async discoverFields(body: Record<string, unknown>) {
    const { sourceType, config } = body as { sourceType: string; config: Record<string, unknown> };

    switch (sourceType) {
      case 'database':
        return { success: true, fields: [{ name: 'id', type: 'uuid' }, { name: 'name', type: 'text' }] };
      case 'api':
        return { success: true, fields: [{ name: 'id', type: 'string' }] };
      case 'file':
      case 'google_sheets':
      case 'ftp':
      case 's3':
        return { success: true, fields: [] };
      default:
        return { success: false, error: `Unknown source type: ${sourceType}` };
    }
  }

  async runScheduled() {
    const supabase = this.supabaseService.getServiceClient();
    const { data: feeds } = await supabase
      .from('data_feeds')
      .select('id, name, schedule, last_run_at')
      .eq('is_active', true)
      .not('schedule', 'is', null)
      .limit(200);

    const results: Record<string, unknown>[] = [];

    for (const feed of feeds || []) {
      if (!feed.schedule) continue;

      if (!shouldRunCronSchedule(feed.schedule, feed.last_run_at)) {
        results.push({ feedId: feed.id, executed: false, skipped: true });
        continue;
      }

      try {
        const result = await this.executeFeed({ feedId: feed.id, triggeredBy: 'schedule' });
        results.push({ feedId: feed.id, executed: true, ...result });
      } catch (err) {
        results.push({ feedId: feed.id, executed: false, error: String(err) });
      }
    }

    return { success: true, processed: results.length, results };
  }

  private async invokeEdgeFunction(
    functionName: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = `${this.supabaseUrl}/functions/v1/${functionName}`;
    const timeoutMs = Number(this.configService.get('EDGE_FUNCTION_TIMEOUT_MS', 120000));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.serviceKey}`,
          apikey: this.serviceKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      let data: Record<string, unknown> = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        const message = (data.error as string) || (data.message as string) || text || response.statusText;
        throw new Error(`${functionName} failed (${response.status}): ${message}`);
      }

      return data;
    } finally {
      clearTimeout(timer);
    }
  }
}
