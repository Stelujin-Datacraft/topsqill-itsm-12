import { Module, forwardRef } from '@nestjs/common';
import { WorkflowQueueService } from './workflow-queue.service';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [forwardRef(() => WorkflowsModule)],
  providers: [WorkflowQueueService],
  exports: [WorkflowQueueService],
})
export class QueueModule {}
