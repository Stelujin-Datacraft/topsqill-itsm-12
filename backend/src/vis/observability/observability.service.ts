/**
 * Stage 7A/7B — Observability: metrics, tracing, alerting, operational health.
 */
import { randomUUID } from 'crypto';
import type { HealthStatus } from '../enterprise/types';
import type { VisStore } from '../store/vis.store';

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  name: string;
  correlationId?: string;
  executionId?: string;
  eventId?: string;
  startedAt: string;
  endedAt?: string;
  attributes?: Record<string, unknown>;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  comparator: 'GT' | 'GTE' | 'LT' | 'LTE';
  enabled: boolean;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface AlertNotification {
  channel: 'log' | 'webhook' | 'email';
  deliver(alert: { ruleId: string; message: string; severity: string; value: number }): Promise<void>;
}

class LogNotifier implements AlertNotification {
  channel = 'log' as const;
  async deliver(alert: { ruleId: string; message: string; severity: string; value: number }) {
    // Structured log only — no secrets
    console.info(JSON.stringify({ type: 'VIS_ALERT', ...alert, at: new Date().toISOString() }));
  }
}

export class ObservabilityService {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private traces: TraceSpan[] = [];
  private notifiers: AlertNotification[] = [new LogNotifier()];
  private rules: AlertRule[] = defaultAlertRules();

  constructor(private readonly store: VisStore) {}

  // ── Metrics ────────────────────────────────────────────────────────────
  incr(name: string, by = 1, labels?: Record<string, string>) {
    const key = labels ? `${name}|${stableLabels(labels)}` : name;
    this.counters.set(key, (this.counters.get(key) || 0) + by);
    this.store.create('metrics', {
      name,
      labels: labels || {},
      value: this.counters.get(key),
      kind: 'counter',
      recordedAt: new Date().toISOString(),
    });
  }

  observe(name: string, valueMs: number, labels?: Record<string, string>) {
    const key = labels ? `${name}|${stableLabels(labels)}` : name;
    const arr = this.histograms.get(key) || [];
    arr.push(valueMs);
    if (arr.length > 5000) arr.shift();
    this.histograms.set(key, arr);
    this.store.create('metrics', {
      name,
      labels: labels || {},
      value: valueMs,
      kind: 'histogram',
      recordedAt: new Date().toISOString(),
    });
  }

  snapshot() {
    const hist: Record<string, { count: number; p50: number; p95: number; p99: number }> = {};
    for (const [k, values] of this.histograms) {
      hist[k] = percentileSummary(values);
    }
    const counters: Record<string, number> = {};
    for (const [k, v] of this.counters) counters[k] = v;
    return { counters, histograms: hist };
  }

  /** Aggregate platform operational metrics from store collections. */
  platformMetrics() {
    const executions = this.store.list('executions');
    const events = this.store.list('events');
    const dlq = this.store.list('deadLetters');
    const eventDlq = this.store.list('eventDeadLetters');
    const success = executions.filter((e) => e.status === 'SUCCESS').length;
    const failed = executions.filter((e) => e.status === 'FAILED').length;
    const partial = executions.filter((e) => e.status === 'PARTIAL_SUCCESS').length;
    return {
      api: this.snapshot(),
      integrations: {
        executions: executions.length,
        success,
        failure: failed,
        partialSuccess: partial,
        dlq: dlq.length,
      },
      events: {
        received: events.length,
        duplicates: events.filter((e) => e.status === 'DUPLICATE').length,
        failures: events.filter((e) => e.status === 'FAILED').length,
        dlq: eventDlq.length,
      },
    };
  }

  // ── Tracing ────────────────────────────────────────────────────────────
  startSpan(opts: {
    name: string;
    traceId?: string;
    parentSpanId?: string;
    correlationId?: string;
    executionId?: string;
    eventId?: string;
    attributes?: Record<string, unknown>;
  }): TraceSpan {
    const span: TraceSpan = {
      traceId: opts.traceId || randomUUID(),
      spanId: randomUUID().slice(0, 16),
      parentSpanId: opts.parentSpanId || null,
      name: opts.name,
      correlationId: opts.correlationId,
      executionId: opts.executionId,
      eventId: opts.eventId,
      startedAt: new Date().toISOString(),
      attributes: sanitizeAttrs(opts.attributes || {}),
    };
    this.traces.push(span);
    this.store.create('traces', { ...span });
    return span;
  }

  endSpan(spanId: string, attributes?: Record<string, unknown>) {
    const span = this.traces.find((t) => t.spanId === spanId);
    if (!span) return null;
    span.endedAt = new Date().toISOString();
    if (attributes) span.attributes = { ...span.attributes, ...sanitizeAttrs(attributes) };
    const row = this.store.list('traces').find((t) => t.spanId === spanId);
    if (row) this.store.update('traces', row.id, { endedAt: span.endedAt, attributes: span.attributes });
    return span;
  }

  getTrace(traceId: string) {
    return this.store.list('traces').filter((t) => t.traceId === traceId);
  }

  // ── Alerting ───────────────────────────────────────────────────────────
  listAlertRules() {
    return [...this.rules];
  }

  upsertAlertRule(rule: AlertRule) {
    const idx = this.rules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) this.rules[idx] = rule;
    else this.rules.push(rule);
    return rule;
  }

  addNotifier(n: AlertNotification) {
    this.notifiers.push(n);
  }

  async evaluateAlerts(metricValues: Record<string, number>) {
    const fired: Array<{ ruleId: string; message: string; severity: string; value: number }> = [];
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      const value = metricValues[rule.metric];
      if (value == null) continue;
      const hit =
        (rule.comparator === 'GT' && value > rule.threshold)
        || (rule.comparator === 'GTE' && value >= rule.threshold)
        || (rule.comparator === 'LT' && value < rule.threshold)
        || (rule.comparator === 'LTE' && value <= rule.threshold);
      if (hit) {
        const alert = {
          ruleId: rule.id,
          message: `${rule.name}: ${rule.metric}=${value} ${rule.comparator} ${rule.threshold}`,
          severity: rule.severity,
          value,
        };
        fired.push(alert);
        this.store.create('alerts', { ...alert, createdAt: new Date().toISOString(), status: 'OPEN' });
        for (const n of this.notifiers) await n.deliver(alert);
      }
    }
    return fired;
  }

  // ── Health ─────────────────────────────────────────────────────────────
  computeHealth(integrationId?: string): {
    status: HealthStatus;
    reasons: string[];
    metrics: Record<string, number>;
  } {
    const executions = this.store
      .list('executions')
      .filter((e) => !integrationId || e.integrationId === integrationId)
      .slice(-50);
    const failed = executions.filter((e) => e.status === 'FAILED').length;
    const total = executions.length || 1;
    const failRate = failed / total;
    const dlq = this.store.list('deadLetters').filter((d) => !integrationId || d.integrationId === integrationId).length;
    const reasons: string[] = [];
    let status: HealthStatus = 'HEALTHY';

    const integration = integrationId ? this.store.get('integrations', integrationId) : null;
    if (integration?.status === 'PAUSED') return { status: 'PAUSED', reasons: ['Integration paused'], metrics: { failRate, dlq } };
    if (integration?.status === 'DISABLED' || integration?.status === 'INACTIVE') {
      return { status: 'DISABLED', reasons: ['Integration disabled'], metrics: { failRate, dlq } };
    }
    if (failRate >= 0.5 || dlq >= 20) {
      status = 'FAILING';
      reasons.push(`Failure rate ${(failRate * 100).toFixed(0)}%`, `DLQ=${dlq}`);
    } else if (failRate >= 0.2 || dlq >= 5) {
      status = 'DEGRADED';
      reasons.push(`Elevated failures ${(failRate * 100).toFixed(0)}%`, `DLQ=${dlq}`);
    }
    return { status, reasons, metrics: { failRate, dlq, recentExecutions: executions.length } };
  }
}

function defaultAlertRules(): AlertRule[] {
  return [
    { id: 'fail-rate-high', name: 'Integration failure rate high', metric: 'failure_rate', threshold: 0.2, comparator: 'GTE', enabled: true, severity: 'CRITICAL' },
    { id: 'queue-backlog', name: 'Queue backlog high', metric: 'queue_depth', threshold: 1000, comparator: 'GT', enabled: true, severity: 'WARNING' },
    { id: 'latency-high', name: 'Latency high', metric: 'p95_latency_ms', threshold: 5000, comparator: 'GT', enabled: true, severity: 'WARNING' },
    { id: 'dlq-growing', name: 'DLQ growing', metric: 'dlq_size', threshold: 10, comparator: 'GT', enabled: true, severity: 'CRITICAL' },
    { id: 'oauth-refresh-fail', name: 'OAuth refresh failures', metric: 'oauth_refresh_failures', threshold: 3, comparator: 'GTE', enabled: true, severity: 'CRITICAL' },
    { id: 'auth-failures', name: 'Authentication failures', metric: 'auth_failures', threshold: 5, comparator: 'GTE', enabled: true, severity: 'CRITICAL' },
    { id: 'schema-drift', name: 'Schema drift detected', metric: 'schema_drift_breaking', threshold: 0, comparator: 'GT', enabled: true, severity: 'CRITICAL' },
    { id: 'recon-mismatch', name: 'Reconciliation mismatch', metric: 'recon_mismatches', threshold: 0, comparator: 'GT', enabled: true, severity: 'WARNING' },
  ];
}

function percentileSummary(values: number[]) {
  if (!values.length) return { count: 0, p50: 0, p95: 0, p99: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return { count: sorted.length, p50: pct(0.5), p95: pct(0.95), p99: pct(0.99) };
}

function stableLabels(labels: Record<string, string>) {
  return Object.keys(labels).sort().map((k) => `${k}=${labels[k]}`).join(',');
}

function sanitizeAttrs(attrs: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (/password|secret|token|api[_-]?key|authorization|credential/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}
