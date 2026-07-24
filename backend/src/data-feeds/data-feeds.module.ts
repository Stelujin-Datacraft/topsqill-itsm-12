import { Module, forwardRef } from '@nestjs/common';
import { DataFeedsService } from './data-feeds.service';
import { DataFeedsController } from './data-feeds.controller';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [forwardRef(() => WorkflowsModule)],
  providers: [DataFeedsService],
  controllers: [DataFeedsController],
  exports: [DataFeedsService],
})
export class DataFeedsModule {}
