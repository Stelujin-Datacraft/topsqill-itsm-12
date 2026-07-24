import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DataFeedsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  async executeFeed(body: { feedId: string }) {
    const supabase = this.supabaseService.getServiceClient();
    const { feedId } = body;

    const { data: feed, error } = await supabase
      .from('data_feeds')
      .select('*')
      .eq('id', feedId)
      .single();

    if (error || !feed) return { success: false, error: 'Feed not found' };

    const { data: run } = await supabase
      .from('data_feed_runs')
      .insert({
        feed_id: feedId,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    try {
      const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

      await supabase
        .from('data_feed_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_created: result.created,
          records_updated: result.updated,
          records_skipped: result.skipped,
        })
        .eq('id', run.id);

      return { success: true, runId: run.id, ...result };
    } catch (err) {
      await supabase
        .from('data_feed_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq('id', run.id);

      throw err;
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
      .select('id, name, schedule_cron')
      .eq('is_active', true)
      .not('schedule_cron', 'is', null);

    const results: Record<string, unknown>[] = [];
    for (const feed of feeds || []) {
      try {
        const result = await this.executeFeed({ feedId: feed.id });
        results.push({ feedId: feed.id, ...result });
      } catch (err) {
        results.push({ feedId: feed.id, success: false, error: String(err) });
      }
    }

    return { success: true, processed: results.length, results };
  }
}
