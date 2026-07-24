import { Module } from '@nestjs/common';
import { DataFeedsService } from './data-feeds.service';
import { DataFeedsController } from './data-feeds.controller';

@Module({
  providers: [DataFeedsService],
  controllers: [DataFeedsController],
  exports: [DataFeedsService],
})
export class DataFeedsModule {}
