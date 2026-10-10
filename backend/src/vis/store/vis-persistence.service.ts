/**
 * Boot-time hydrate for Supabase-backed VIS.
 * A missing schema is logged and does not switch the process to file storage.
 * Set VIS_REQUIRE_SCHEMA=1 to fail process startup until the migration is applied.
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { getVisStore } from './vis.store';
import { VIS_SCHEMA_MIGRATION } from './supabase-vis.store';

@Injectable()
export class VisPersistenceService implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    const store = getVisStore();
    if (!store.isSupabaseBacked) return;
    try {
      await store.hydrate();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[VIS] Supabase hydrate failed. Persistence stays on Supabase; file/memory fallback is disabled. `
        + `Apply ${VIS_SCHEMA_MIGRATION}. ${message}`,
      );
      if (process.env.VIS_REQUIRE_SCHEMA === '1') throw error;
    }
  }
}
