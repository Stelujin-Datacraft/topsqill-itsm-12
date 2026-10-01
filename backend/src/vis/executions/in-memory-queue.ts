/**
 * Lightweight in-process queues for Phase 3.
 * Optional Redis/BullMQ can wrap the same job shapes later.
 * Queue payloads never contain secrets — credentialReferenceId only.
 */

export type VisQueueName =
  | 'integration-discovery'
  | 'integration-records'
  | 'integration-retry'
  | 'integration-dead-letter';

export interface RecordJob {
  executionId: string;
  integrationId: string;
  correlationId: string;
  credentialRefId: string | null;
  sourceRecordId: string;
  sourceRecord: Record<string, unknown>;
  attempt: number;
  /** Never include tokens/secrets */
  metadata?: Record<string, unknown>;
}

export interface DeadLetterRecord {
  integrationId: string;
  executionId: string;
  correlationId: string;
  sourceRecord: Record<string, unknown>;
  transformedRecord?: Record<string, unknown> | null;
  errorCode: string;
  errorMessage: string;
  retryCount: number;
  timestamp: string;
  ignored?: boolean;
}

export class InMemoryQueue<T> {
  private items: T[] = [];
  private waiters: Array<(item: T | null) => void> = [];
  private closed = false;

  get depth(): number {
    return this.items.length;
  }

  enqueue(item: T): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter(item);
    else this.items.push(item);
  }

  async dequeue(timeoutMs = 100): Promise<T | null> {
    if (this.items.length) return this.items.shift()!;
    if (this.closed) return null;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(resolver);
        if (idx >= 0) this.waiters.splice(idx, 1);
        resolve(null);
      }, timeoutMs);
      const resolver = (item: T | null) => {
        clearTimeout(timer);
        resolve(item);
      };
      this.waiters.push(resolver);
    });
  }

  drain(): T[] {
    const all = this.items.splice(0);
    return all;
  }

  close(): void {
    this.closed = true;
    while (this.waiters.length) this.waiters.shift()?.(null);
  }
}

export class VisQueueManager {
  readonly discovery = new InMemoryQueue<Record<string, unknown>>();
  readonly records = new InMemoryQueue<RecordJob>();
  readonly retry = new InMemoryQueue<RecordJob>();
  readonly deadLetter: DeadLetterRecord[] = [];

  enqueueRecord(job: RecordJob): void {
    this.records.enqueue(job);
  }

  enqueueRetry(job: RecordJob): void {
    this.retry.enqueue(job);
  }

  toDeadLetter(row: DeadLetterRecord): void {
    this.deadLetter.push(row);
  }

  close(): void {
    this.discovery.close();
    this.records.close();
    this.retry.close();
  }
}
