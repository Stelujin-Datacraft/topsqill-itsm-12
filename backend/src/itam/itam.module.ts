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
    // Fail closed: never silently fall back to memory in Dev/Prod or container boots.
    const mode = resolveDiscoveryPersistenceMode();
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
  }
}
