/**
 * Polling fallback — generates normalized events and feeds EventIngestion/Router path.
 * Does NOT create a separate mapping pipeline.
 */
import type { VisStore } from '../store/vis.store';
import type { EventEnvelope } from '../core/types/index';
import { normalizeEvent } from './event-normalizer';
import type { EventIngestionService } from './event-ingestion';

export interface PollCheckpoint {
  integrationId: string;
  cursor: string;
  updatedAt: string;
}

export class PollingFallbackService {
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private checkpoints = new Map<string, PollCheckpoint>();

  constructor(
    private readonly store: VisStore,
    private readonly ingestion: EventIngestionService,
  ) {}

  getCheckpoint(integrationId: string): PollCheckpoint | null {
    return this.checkpoints.get(integrationId) || null;
  }

  /**
   * One poll cycle: read mock records updated since checkpoint, emit RECORD_UPDATED/CREATED events.
   */
  async pollOnce(integrationId: string): Promise<{ emitted: number }> {
    const cfg = this.ingestion.getEventConfig(integrationId);
    const endpoint = this.ingestion.ensureEndpoint(integrationId);
    const cp = this.checkpoints.get(integrationId);
    const since = cp?.cursor ? new Date(cp.cursor).getTime() : 0;
    const formId =
      (this.store.get('integrations', integrationId) &&
        ((this.store.get('versions', String(this.store.get('integrations', integrationId)!.currentVersionId))
          ?.directions as any[]) || [])[0]?.selectedFormId) || 'form-vulnerability';

    const records = this.store
      .list('mockRecords')
      .filter((r) => r.formId === formId)
      .filter((r) => {
        const updated = new Date(String(r.updatedAt || r.createdAt || 0)).getTime();
        return updated > since;
      });

    let emitted = 0;
    let maxTs = since;
    for (const r of records) {
      const data = (r.data || {}) as Record<string, unknown>;
      const entityId = String(data.vulnerability_id || data.id || r.id);
      const updated = new Date(String(r.updatedAt || r.createdAt || Date.now())).getTime();
      maxTs = Math.max(maxTs, updated);
      const isCreate = new Date(String(r.createdAt || 0)).getTime() > since;
      const envelopeBody = {
        eventId: `poll-${integrationId}-${entityId}-${updated}`,
        eventType: isCreate ? 'RECORD_CREATED' : 'RECORD_UPDATED',
        entityType: 'Vulnerability',
        entityId,
        sourceEnvironment: cfg.sourceEnvironmentId || 'DEV',
        payload: { id: entityId, ...data },
      };
      await this.ingestion.ingestWebhook({
        endpointId: endpoint.id,
        headers: {},
        rawBody: JSON.stringify(envelopeBody),
        parsedBody: envelopeBody,
      });
      emitted += 1;
    }

    this.checkpoints.set(integrationId, {
      integrationId,
      cursor: new Date(maxTs || Date.now()).toISOString(),
      updatedAt: new Date().toISOString(),
    });
    this.store.create('eventCheckpoints', {
      integrationId,
      checkpointType: 'TIMESTAMP',
      checkpointValue: this.checkpoints.get(integrationId)!.cursor,
      updatedAt: new Date().toISOString(),
    });
    return { emitted };
  }

  start(integrationId: string, intervalSeconds: number) {
    this.stop(integrationId);
    const handle = setInterval(() => {
      void this.pollOnce(integrationId);
    }, Math.max(1, intervalSeconds) * 1000);
    if (typeof handle === 'object' && 'unref' in handle) (handle as NodeJS.Timeout).unref?.();
    this.timers.set(integrationId, handle);
  }

  stop(integrationId: string) {
    const t = this.timers.get(integrationId);
    if (t) clearInterval(t);
    this.timers.delete(integrationId);
  }
}

/** Convenience for tests — build envelope without ingesting. */
export function recordToEvent(
  record: Record<string, unknown>,
  eventType: string,
): EventEnvelope {
  return normalizeEvent({
    body: {
      eventType,
      entityId: String(record.id || record.vulnerability_id),
      entityType: 'Vulnerability',
      payload: record,
    },
  });
}
