import { Module, forwardRef } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { WorkflowExecutorService } from './workflow-executor.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [forwardRef(() => QueueModule)],
  providers: [WorkflowsService, WorkflowExecutorService],
  controllers: [WorkflowsController],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
