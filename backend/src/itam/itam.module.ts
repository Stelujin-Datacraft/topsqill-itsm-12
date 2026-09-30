import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ItamService } from './itam.service';
import { ItamController } from './itam.controller';
import { ItamDiscoveryService } from './discovery/discovery.service';
import { ItamDiscoveryController } from './discovery/discovery.controller';

@Module({
  providers: [ItamService, ItamDiscoveryService],
  controllers: [ItamController, ItamDiscoveryController],
  exports: [ItamService, ItamDiscoveryService],
})
export class ItamModule implements OnModuleInit {
  private readonly logger = new Logger(ItamModule.name);

  constructor(private readonly discovery: ItamDiscoveryService) {}

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
        this.logger.log(`ITAM discovery persistence: ${this.discovery.persistenceMode()}`);
      } catch (e: any) {
        if (process.env.NODE_ENV === 'production') {
          throw e;
        }
        this.logger.warn(`ITAM discovery postgres init failed — falling back to memory: ${e?.message || e}`);
        await this.discovery.initializePersistence({ mode: 'memory' });
      }
    } else {
      await this.discovery.initializePersistence({ mode: 'memory' });
      this.logger.log('ITAM discovery persistence: memory (set ITAM_DISCOVERY_DATABASE_URL for postgres)');
    }
  }
}
