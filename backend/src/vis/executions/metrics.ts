import type { ExecutionMetrics } from '../core/types/index';

export class MetricsCollector {
  private latencies: number[] = [];
  metrics: ExecutionMetrics = {
    recordsRead: 0,
    recordsProcessed: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsFailed: 0,
    recordsRetried: 0,
    recordsSkipped: 0,
    requests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitResponses: 0,
    authenticationRefreshes: 0,
    startedAt: null,
    completedAt: null,
  };

  start() {
    this.metrics.startedAt = new Date().toISOString();
  }

  complete() {
    this.metrics.completedAt = new Date().toISOString();
    if (this.metrics.startedAt) {
      const secs =
        (new Date(this.metrics.completedAt).getTime()
          - new Date(this.metrics.startedAt).getTime())
        / 1000;
      if (secs > 0) {
        this.metrics.recordsPerSecond = this.metrics.recordsProcessed / secs;
      }
    }
    if (this.latencies.length) {
      const sum = this.latencies.reduce((a, b) => a + b, 0);
      this.metrics.averageLatencyMs = sum / this.latencies.length;
    }
  }

  recordLatency(ms: number) {
    this.latencies.push(ms);
  }

  percentile(p: number): number {
    if (!this.latencies.length) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
  }

  snapshot() {
    return {
      ...this.metrics,
      p95LatencyMs: this.percentile(95),
      p99LatencyMs: this.percentile(99),
    };
  }
}
