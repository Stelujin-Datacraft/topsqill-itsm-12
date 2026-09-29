/** Circuit breaker: CLOSED → OPEN → HALF_OPEN → CLOSED */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private openedAt = 0;
  private halfOpenTrials = 0;

  constructor(
    private readonly failureThreshold = 5,
    private readonly cooldownMs = 15000,
    private readonly halfOpenMax = 2,
  ) {}

  getState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() - this.openedAt >= this.cooldownMs) {
      this.state = 'HALF_OPEN';
      this.halfOpenTrials = 0;
    }
    return this.state;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.getState();
    if (state === 'OPEN') {
      throw new Error('Circuit breaker OPEN — target temporarily unavailable');
    }
    if (state === 'HALF_OPEN' && this.halfOpenTrials >= this.halfOpenMax) {
      throw new Error('Circuit breaker HALF_OPEN trial limit reached');
    }
    if (state === 'HALF_OPEN') this.halfOpenTrials += 1;
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (e) {
      this.onFailure();
      throw e;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
    this.halfOpenTrials = 0;
  }

  private onFailure() {
    this.failures += 1;
    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}
