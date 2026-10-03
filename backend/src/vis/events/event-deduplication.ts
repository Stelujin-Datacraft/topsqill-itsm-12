/**
 * Event deduplication — provider eventId or content hash.
 * In-memory + optional Redis-shaped interface.
 */
import { createHash } from 'crypto';
import type { EventEnvelope, EventDedupStrategy } from '../core/types/index';

export type DedupOutcome = 'FIRST_SEEN' | 'DUPLICATE' | 'PROCESSED' | 'FAILED';

export interface DedupRecord {
  key: string;
  outcome: DedupOutcome;
  eventId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  count: number;
}

export class EventDeduplicationService {
  private store = new Map<string, DedupRecord>();

  constructor(private readonly defaultTtlMs = 24 * 60 * 60 * 1000) {}

  buildKey(
    envelope: EventEnvelope,
    strategy: EventDedupStrategy = 'PROVIDER_EVENT_ID',
  ): string {
    if (strategy === 'PROVIDER_EVENT_ID' && envelope.eventId) {
      return `evt:${envelope.sourceSystem}:${envelope.sourceEnvironment}:${envelope.eventId}`;
    }
    const basis = [
      envelope.sourceSystem,
      envelope.sourceEnvironment,
      envelope.eventType,
      envelope.entityType,
      envelope.entityId,
      envelope.eventVersion,
      envelope.payloadHash || '',
    ].join('|');
    return `hash:${createHash('sha256').update(basis).digest('hex')}`;
  }

  /** Returns DUPLICATE if already seen; otherwise records FIRST_SEEN. */
  check(
    envelope: EventEnvelope,
    strategy: EventDedupStrategy = 'PROVIDER_EVENT_ID',
    ttlMs?: number,
  ): DedupOutcome {
    this.gc();
    const key = this.buildKey(envelope, strategy);
    const now = Date.now();
    const existing = this.store.get(key);
    if (existing) {
      // TTL expiry
      if (now - new Date(existing.firstSeenAt).getTime() > (ttlMs ?? this.defaultTtlMs)) {
        this.store.delete(key);
      } else {
        existing.count += 1;
        existing.lastSeenAt = new Date().toISOString();
        existing.outcome = existing.outcome === 'PROCESSED' ? 'PROCESSED' : 'DUPLICATE';
        return 'DUPLICATE';
      }
    }
    this.store.set(key, {
      key,
      outcome: 'FIRST_SEEN',
      eventId: envelope.eventId,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      count: 1,
    });
    return 'FIRST_SEEN';
  }

  markProcessed(envelope: EventEnvelope, strategy: EventDedupStrategy = 'PROVIDER_EVENT_ID') {
    const key = this.buildKey(envelope, strategy);
    const row = this.store.get(key);
    if (row) row.outcome = 'PROCESSED';
  }

  markFailed(envelope: EventEnvelope, strategy: EventDedupStrategy = 'PROVIDER_EVENT_ID') {
    const key = this.buildKey(envelope, strategy);
    const row = this.store.get(key);
    if (row) row.outcome = 'FAILED';
  }

  private gc() {
    if (this.store.size < 10_000) return;
    const cutoff = Date.now() - this.defaultTtlMs;
    for (const [k, v] of this.store) {
      if (new Date(v.firstSeenAt).getTime() < cutoff) this.store.delete(k);
    }
  }
}
