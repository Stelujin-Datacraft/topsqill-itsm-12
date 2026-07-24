import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { shouldRunCronSchedule } from '../common/utils/cron-schedule.util';
import { SupabaseService } from '../supabase/supabase.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { discoverExternalFields } from './engines/discover-fields.engine';
import { executeDataFeed } from './engines/execute-feed.engine';

@Injectable()
export class DataFeedsService {
  private readonly logger = new Logger(DataFeedsService.name);
  private readonly supabaseUrl: string;
  private readonly serviceKey: string;
  private readonly executorMode: string;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WorkflowsService))
    private readonly workflowsService: WorkflowsService,
  ) {
    this.supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    this.serviceKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.executorMode = 'nestjs';
  }

  async executeFeed(body: { feedId: string; triggeredBy?: string }): Promise<Record<string, unknown>> {
    const { feedId, triggeredBy } = body;

    if (this.executorMode === 'edge') {
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

    const supabase = this.supabaseService.getServiceClient();
    const result = await executeDataFeed(
      supabase,
      { feedId, triggeredBy: triggeredBy || 'api' },
      {
        notifyFailure: (payload) => this.workflowsService.notifyFailure(payload as {
          entity_type: string;
          entity_id: string;
          error: string;
          context?: unknown;
        }),
      },
    );
    return result;
  }

  async discoverFields(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.executorMode === 'edge') {
      try {
        return await this.invokeEdgeFunction('discover-external-fields', body);
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    const supabase = this.supabaseService.getServiceClient();
    return discoverExternalFields(supabase, body);
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
