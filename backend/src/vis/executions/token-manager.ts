/**
 * Token manager — proactive refresh + distributed (or in-process) refresh lock.
 * Queue messages carry credentialReferenceId only — never raw secrets.
 */
export interface TokenState {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  tokenType?: string;
}

export interface TokenProvider {
  /** Load current token state for a credential reference (no secrets logged). */
  load(credentialRefId: string): Promise<TokenState | null>;
  /** Persist refreshed token. */
  save(credentialRefId: string, state: TokenState): Promise<void>;
  /** Perform refresh against IdP — returns new state. */
  refresh(credentialRefId: string, current: TokenState | null): Promise<TokenState>;
}

export interface DistributedLock {
  acquire(key: string, ttlMs: number): Promise<boolean>;
  release(key: string): Promise<void>;
}

/** In-process lock — used when Redis is unavailable. Sufficient for single-node. */
export class InMemoryLock implements DistributedLock {
  private locks = new Map<string, { expires: number }>();

  async acquire(key: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.locks.get(key);
    if (existing && existing.expires > now) return false;
    this.locks.set(key, { expires: now + ttlMs });
    return true;
  }

  async release(key: string): Promise<void> {
    this.locks.delete(key);
  }
}

export class TokenManager {
  private refreshCount = 0;

  constructor(
    private readonly provider: TokenProvider,
    private readonly lock: DistributedLock = new InMemoryLock(),
    private readonly refreshSkewMs = 5 * 60 * 1000,
  ) {}

  getRefreshCount(): number {
    return this.refreshCount;
  }

  resetRefreshCount(): void {
    this.refreshCount = 0;
  }

  /** Returns a valid access token, refreshing if near expiry / expired. */
  async getAccessToken(credentialRefId: string): Promise<string> {
    const current = await this.provider.load(credentialRefId);
    if (current && current.expiresAt - Date.now() > this.refreshSkewMs) {
      return current.accessToken;
    }
    return this.refreshWithLock(credentialRefId, current);
  }

  /** After 401 — refresh once under lock, then return new token. */
  async refreshAfterUnauthorized(credentialRefId: string): Promise<string> {
    const current = await this.provider.load(credentialRefId);
    return this.refreshWithLock(credentialRefId, current);
  }

  private async refreshWithLock(
    credentialRefId: string,
    current: TokenState | null,
  ): Promise<string> {
    const key = `vis:token-refresh:${credentialRefId}`;
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const got = await this.lock.acquire(key, 10000);
      if (got) {
        try {
          // Re-check after acquire — another worker may have refreshed
          const latest = await this.provider.load(credentialRefId);
          if (latest && latest.expiresAt - Date.now() > this.refreshSkewMs) {
            return latest.accessToken;
          }
          const next = await this.provider.refresh(credentialRefId, latest || current);
          await this.provider.save(credentialRefId, next);
          this.refreshCount += 1;
          return next.accessToken;
        } finally {
          await this.lock.release(key);
        }
      }
      // Wait briefly for holder
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 50));
      const maybe = await this.provider.load(credentialRefId);
      if (maybe && maybe.expiresAt - Date.now() > this.refreshSkewMs) {
        return maybe.accessToken;
      }
    }
    throw new Error('Token refresh lock timeout');
  }
}
