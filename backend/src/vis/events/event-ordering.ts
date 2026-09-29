/**
 * Event ordering — PER_ENTITY serializes same entityId; others run concurrent.
 */
export class EventOrderingService {
  private entityLocks = new Map<string, Promise<void>>();

  async withOrder<T>(
    strategy: 'NONE' | 'PER_ENTITY' | 'PER_INTEGRATION' | 'GLOBAL',
    keyParts: { integrationId: string; entityId: string },
    fn: () => Promise<T>,
  ): Promise<T> {
    if (strategy === 'NONE') return fn();
    const key =
      strategy === 'GLOBAL'
        ? 'global'
        : strategy === 'PER_INTEGRATION'
          ? `int:${keyParts.integrationId}`
          : `ent:${keyParts.integrationId}:${keyParts.entityId}`;

    const prev = this.entityLocks.get(key) || Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const chain = prev.then(() => gate);
    this.entityLocks.set(
      key,
      chain.catch(() => undefined).then(() => undefined),
    );
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.entityLocks.get(key) === chain) this.entityLocks.delete(key);
    }
  }
}
