import { Module } from '@nestjs/common';
import { VisController } from './integrations/vis.controller';
import { VisMocksController } from './mocks/vis-mocks.controller';
import { VisEventsController } from './events/vis-events.controller';
import { VisEnterpriseController } from './enterprise/vis-enterprise.controller';
import { VisService } from './integrations/vis.service';
import { VisEnterpriseService } from './enterprise/vis-enterprise.service';

@Module({
  controllers: [VisController, VisMocksController, VisEventsController, VisEnterpriseController],
  providers: [VisService, VisEnterpriseService],
  exports: [VisService, VisEnterpriseService],
})
export class VisModule {}
