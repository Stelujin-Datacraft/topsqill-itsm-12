import { Module, forwardRef } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { WorkflowExecutorService } from './workflow-executor.service';
import { NestjsWorkflowEngineService } from './engine/nestjs-workflow-engine.service';
import { QueueModule } from '../queue/queue.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [forwardRef(() => QueueModule), EmailModule],
  providers: [WorkflowsService, WorkflowExecutorService, NestjsWorkflowEngineService],
  controllers: [WorkflowsController],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
