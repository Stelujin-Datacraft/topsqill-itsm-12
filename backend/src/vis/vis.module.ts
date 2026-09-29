import { Module } from '@nestjs/common';
import { VisController } from './integrations/vis.controller';
import { VisMocksController } from './mocks/vis-mocks.controller';
import { VisEventsController } from './events/vis-events.controller';
import { VisService } from './integrations/vis.service';

@Module({
  controllers: [VisController, VisMocksController, VisEventsController],
  providers: [VisService],
  exports: [VisService],
})
export class VisModule {}
