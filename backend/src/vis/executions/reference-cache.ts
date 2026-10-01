/** Reference lookup cache — avoid N identical GET /teams?name=X calls. */
export class ReferenceCache {
  private cache = new Map<string, { value: string; expires: number }>();

  constructor(private readonly ttlMs = 5 * 60 * 1000) {}

  get(key: string): string | undefined {
    const hit = this.cache.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: string): void {
    this.cache.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  size(): number {
    return this.cache.size;
  }
}
