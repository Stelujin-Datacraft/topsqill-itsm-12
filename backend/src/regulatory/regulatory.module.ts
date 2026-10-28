import { Module } from '@nestjs/common';
import { RegulatoryAccessGuard } from './regulatory-access.guard';
import { RegulatoryController } from './regulatory.controller';
import { RegulatoryService } from './regulatory.service';

@Module({
  controllers: [RegulatoryController],
  providers: [RegulatoryService, RegulatoryAccessGuard],
  exports: [RegulatoryService],
})
export class RegulatoryModule {}
