import { Module } from '@nestjs/common';
import { ItamService } from './itam.service';
import { ItamController } from './itam.controller';
import { ItamDiscoveryService } from './discovery/discovery.service';
import { ItamDiscoveryController } from './discovery/discovery.controller';

@Module({
  providers: [ItamService, ItamDiscoveryService],
  controllers: [ItamController, ItamDiscoveryController],
  exports: [ItamService, ItamDiscoveryService],
})
export class ItamModule {}
