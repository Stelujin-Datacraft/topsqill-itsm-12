import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ItamService } from './itam.service';
import { ItamController } from './itam.controller';
import { ItamDiscoveryService } from './discovery/discovery.service';
import { ItamDiscoveryController } from './discovery/discovery.controller';
import { ItamCloudService } from './cloud/cloud.service';
import { ItamCloudController } from './cloud/cloud.controller';
import { ItamFormSyncService } from './sync/sync.service';
import { ItamFormSyncController } from './sync/sync.controller';
import {
  resolveDeploymentEnvironment,
  resolveDiscoveryPersistenceMode,
  shouldApplyDiscoverySchema,
} from './discovery/persistence-config';
import { isItamDiscoverySchemaMissingError } from './discovery/schema-missing.error';

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
    const deployment = resolveDeploymentEnvironment();
    const mode = resolveDiscoveryPersistenceMode();
    try {
      await this.discovery.initializePersistence({
        mode,
        applySchema: shouldApplyDiscoverySchema(),
      });
      this.cloud.refreshStore();
      this.sync.refreshStore();
      this.logger.log(
        `ITAM persistence: ${this.discovery.persistenceMode()} `
          + `(deployment=${deployment}, NODE_ENV=${process.env.NODE_ENV || 'unset'}, `
          + `applySchema=${shouldApplyDiscoverySchema()})`,
      );
    } catch (e: any) {
      if (isItamDiscoverySchemaMissingError(e)) {
        // Do not crash Nest / Docker-restart-loop: keep other modules up.
        // ITAM APIs stay fail-closed (ServiceUnavailable) until Dev SQL is applied.
        this.discovery.markSchemaUnavailable(e);
        this.logger.error(
          `ITAM Discovery unavailable — required Supabase schema missing `
            + `(deployment=${deployment}). Keep ITAM_DISCOVERY_APPLY_SCHEMA=0. `
            + `Apply Dev-only migrations listed in the error, then restart.\n${e.message}`,
        );
        return;
      }
      throw e;
    }
  }
}
