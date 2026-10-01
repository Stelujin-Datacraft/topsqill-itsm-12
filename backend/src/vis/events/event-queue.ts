/**
 * Lightweight in-process event queues (shapes ready for BullMQ).
 * Payloads never contain secrets.
 */
import type { EventEnvelope } from '../core/types/index';

export interface EventJob {
  eventRecordId: string;
  integrationId: string;
  endpointId: string;
  envelope: EventEnvelope;
  attempt: number;
  replayOf?: string | null;
}

export class EventQueue {
  private items: EventJob[] = [];
  private waiters: Array<(j: EventJob | null) => void> = [];
  private closed = false;

  get depth() {
    return this.items.length;
  }

  enqueue(job: EventJob) {
    if (this.closed) return;
    const w = this.waiters.shift();
    if (w) w(job);
    else this.items.push(job);
  }

  async dequeue(timeoutMs = 100): Promise<EventJob | null> {
    if (this.items.length) return this.items.shift()!;
    if (this.closed) return null;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(resolver);
        if (idx >= 0) this.waiters.splice(idx, 1);
        resolve(null);
      }, timeoutMs);
      const resolver = (j: EventJob | null) => {
        clearTimeout(timer);
        resolve(j);
      };
      this.waiters.push(resolver);
    });
  }

  close() {
    this.closed = true;
    while (this.waiters.length) this.waiters.shift()?.(null);
  }
}

export class EventQueueManager {
  readonly processing = new EventQueue();
  readonly retry = new EventQueue();
  readonly deadLetter: EventJob[] = [];

  close() {
    this.processing.close();
    this.retry.close();
  }
}
