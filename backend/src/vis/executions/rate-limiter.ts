/** Simple token-bucket rate limiter (per-minute + max concurrent). */
export class RateLimiter {
  private timestamps: number[] = [];
  private inflight = 0;

  constructor(
    private readonly perMinute: number | null,
    private readonly maxConcurrent: number,
  ) {}

  async acquire(): Promise<void> {
    while (this.inflight >= this.maxConcurrent) {
      await new Promise((r) => setTimeout(r, 10));
    }
    if (this.perMinute && this.perMinute > 0) {
      for (;;) {
        const now = Date.now();
        this.timestamps = this.timestamps.filter((t) => now - t < 60_000);
        if (this.timestamps.length < this.perMinute) break;
        const wait = 60_000 - (now - this.timestamps[0]) + 5;
        await new Promise((r) => setTimeout(r, Math.max(5, wait)));
      }
      this.timestamps.push(Date.now());
    }
    this.inflight += 1;
  }

  release(): void {
    this.inflight = Math.max(0, this.inflight - 1);
  }

  async respectRetryAfter(seconds: number): Promise<void> {
    await new Promise((r) => setTimeout(r, Math.max(0, seconds) * 1000));
  }
}
