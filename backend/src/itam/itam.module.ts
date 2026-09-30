import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ItamService } from './itam.service';
import { ItamController } from './itam.controller';
import { ItamDiscoveryService } from './discovery/discovery.service';
import { ItamDiscoveryController } from './discovery/discovery.controller';
import { ItamCloudService } from './cloud/cloud.service';
import { ItamCloudController } from './cloud/cloud.controller';
import { ItamFormSyncService } from './sync/sync.service';
import { ItamFormSyncController } from './sync/sync.controller';

@Module({
  providers: [ItamService, ItamDiscoveryService, ItamCloudService, ItamFormSyncService],
  controllers: [ItamController, ItamDiscoveryController, ItamCloudController, ItamFormSyncController],
  exports: [ItamService, ItamDiscoveryService, ItamCloudService, ItamFormSyncService],
})
export class ItamModule implements OnModuleInit {
  private readonly logger = new Logger(ItamModule.name);

  constructor(
    private readonly discovery: ItamDiscoveryService,
    private readonly cloud: ItamCloudService,
    private readonly sync: ItamFormSyncService,
  ) {}

  async onModuleInit() {
    const mode =
      (process.env.ITAM_DISCOVERY_PERSISTENCE as 'memory' | 'postgres' | undefined)
      || (process.env.ITAM_DISCOVERY_DATABASE_URL ? 'postgres' : undefined);

    if (mode === 'postgres' || process.env.NODE_ENV === 'production') {
      try {
        await this.discovery.initializePersistence({
          mode: 'postgres',
          applySchema: process.env.ITAM_DISCOVERY_APPLY_SCHEMA !== '0',
        });
        this.cloud.refreshStore();
        this.sync.refreshStore();
        this.logger.log(`ITAM persistence: ${this.discovery.persistenceMode()} (A–D + form-sync)`);
      } catch (e: any) {
        if (process.env.NODE_ENV === 'production') throw e;
        this.logger.warn(`ITAM postgres init failed — memory: ${e?.message || e}`);
        await this.discovery.initializePersistence({ mode: 'memory' });
        this.cloud.refreshStore();
        this.sync.refreshStore();
      }
    } else {
      await this.discovery.initializePersistence({ mode: 'memory' });
      this.cloud.refreshStore();
      this.sync.refreshStore();
      this.logger.log('ITAM persistence: memory');
    }
  }
}
