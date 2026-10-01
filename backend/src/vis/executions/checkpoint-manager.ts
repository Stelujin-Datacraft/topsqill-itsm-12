/** Checkpoint persistence for incremental / resumable sync. */
export type CheckpointType = 'PAGE' | 'TIMESTAMP' | 'ID' | 'CURSOR';

export interface Checkpoint {
  integrationId: string;
  source: string;
  checkpointType: CheckpointType;
  checkpointValue: string;
  updatedAt: string;
}

export class CheckpointManager {
  private store = new Map<string, Checkpoint>();

  key(integrationId: string, source: string): string {
    return `${integrationId}::${source}`;
  }

  get(integrationId: string, source: string): Checkpoint | null {
    return this.store.get(this.key(integrationId, source)) || null;
  }

  /** Only call after successful processing of the page/batch. */
  commit(
    integrationId: string,
    source: string,
    checkpointType: CheckpointType,
    checkpointValue: string,
  ): Checkpoint {
    const row: Checkpoint = {
      integrationId,
      source,
      checkpointType,
      checkpointValue,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(this.key(integrationId, source), row);
    return row;
  }
}
