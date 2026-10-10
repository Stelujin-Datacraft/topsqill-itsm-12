import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getVisStore } from './vis.store';

/**
 * Hydrate durable VIS cache from Supabase at Nest boot.
 * Fail-closed in production when Supabase credentials / tables are missing.
 */
@Injectable()
export class VisBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(VisBootstrapService.name);

  async onModuleInit() {
    const store = getVisStore();
    if (!store.isDurableBacked) {
      this.logger.warn('VIS running in file/memory mode (not durable)');
      return;
    }
    await store.hydrateFromDurable();
    this.logger.log('VIS durable store hydrated from Supabase');
  }
}
