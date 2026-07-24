import { Module } from '@nestjs/common';
import { ItamService } from './itam.service';
import { ItamController } from './itam.controller';

@Module({
  providers: [ItamService],
  controllers: [ItamController],
})
export class ItamModule {}
