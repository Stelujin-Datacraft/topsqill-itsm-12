/** Event-level metrics for realtime dashboard. */
import type { EventMetricsSnapshot } from '../core/types/index';

export class EventMetricsService {
  private latencies: number[] = [];
  private metrics: EventMetricsSnapshot = {
    eventsReceived: 0,
    eventsAccepted: 0,
    eventsRejected: 0,
    eventsDuplicated: 0,
    eventsProcessing: 0,
    eventsSucceeded: 0,
    eventsFailed: 0,
    eventsRetried: 0,
    eventsDlq: 0,
    eventsReplayed: 0,
    queueDepth: 0,
    activeWorkers: 0,
    rateLimitResponses: 0,
    oauthRefreshes: 0,
  };

  snapshot(extra?: Partial<EventMetricsSnapshot>): EventMetricsSnapshot {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const pct = (p: number) =>
      sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0;
    const avg =
      sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : undefined;
    return {
      ...this.metrics,
      ...extra,
      avgEndToEndLatencyMs: avg,
      p50LatencyMs: pct(50),
      p95LatencyMs: pct(95),
      p99LatencyMs: pct(99),
    };
  }

  inc(field: keyof EventMetricsSnapshot, by = 1) {
    const cur = this.metrics[field];
    if (typeof cur === 'number') (this.metrics as any)[field] = cur + by;
  }

  set(field: keyof EventMetricsSnapshot, value: number) {
    (this.metrics as any)[field] = value;
  }

  recordLatency(ms: number) {
    this.latencies.push(ms);
    if (this.latencies.length > 50_000) this.latencies.splice(0, this.latencies.length - 25_000);
  }
}
