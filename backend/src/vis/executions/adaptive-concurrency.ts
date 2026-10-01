/**
 * Configurable concurrency limit for Phase 3.
 * Adaptive increase/decrease interfaces are designed for a later phase.
 */

export interface AdaptiveConcurrencyController {
  /** Current allowed concurrent in-flight operations. */
  getLimit(): number;
  /** Observe a successful request (may gradually increase). */
  onSuccess(latencyMs: number): void;
  /** Observe a rate-limit (429) — should reduce. */
  onRateLimit(): void;
  /** Observe elevated latency — may reduce. */
  onHighLatency(latencyMs: number): void;
  /** Observe target healthy again. */
  onHealthy(): void;
}

/** Safe fixed concurrency — Phase 3 default. Adaptive hooks are no-ops except rate-limit clamp. */
export class ConfigurableConcurrency implements AdaptiveConcurrencyController {
  private limit: number;
  private readonly min: number;
  private readonly max: number;

  constructor(initial: number, opts?: { min?: number; max?: number }) {
    this.min = opts?.min ?? 1;
    this.max = opts?.max ?? Math.max(initial, 50);
    this.limit = Math.max(this.min, Math.min(this.max, initial));
  }

  getLimit(): number {
    return this.limit;
  }

  onSuccess(_latencyMs: number): void {
    // Phase 3: no auto-ramp; reserved for adaptive concurrency
  }

  onRateLimit(): void {
    this.limit = Math.max(this.min, Math.floor(this.limit / 2));
  }

  onHighLatency(_latencyMs: number): void {
    // Designed for later adaptive reduction
  }

  onHealthy(): void {
    // Designed for later gradual increase
  }

  setLimit(n: number): void {
    this.limit = Math.max(this.min, Math.min(this.max, n));
  }
}
