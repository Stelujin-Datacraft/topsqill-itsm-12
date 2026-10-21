import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Public()
  @Post('enqueue')
  enqueue(@Body() body: Record<string, unknown>) {
    return this.workflowsService.enqueue(body);
  }

  /** Manual retry — authenticated; service-role write after org/project authz check. */
  @UseGuards(SupabaseAuthGuard)
  @Post('queue/retry')
  retryQueueItem(
    @Body() body: { queue_id?: string; id?: string },
    @Req() req: { user?: { id?: string } },
  ) {
    const userId = req.user?.id;
    const queueId = body?.queue_id || body?.id;
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }
    if (!queueId) {
      return { success: false, error: 'queue_id is required' };
    }
    return this.workflowsService.retryQueueItem(userId, queueId);
  }

  @Public()
  @Post('execute')
  execute(@Body() body: {
    workflowId: string;
    queueId?: string;
    executionId?: string;
    submissionId?: string;
    triggerData?: unknown;
  }) {
    return this.workflowsService.executeWorkflow(
      body.workflowId,
      body.queueId ?? body.executionId,
      body.submissionId,
      body.triggerData,
    );
  }

  @Public()
  @Post('process-queue')
  processQueue() {
    return this.workflowsService.processQueue();
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('resume-waiting')
  resumeWaiting(@Body() body?: Record<string, unknown>) {
    return this.workflowsService.resumeWaiting(body);
  }

  @Public()
  @Post('notify-failure')
  notifyFailure(@Body() body: { entity_type: string; entity_id: string; error: string; context?: unknown }) {
    return this.workflowsService.notifyFailure(body);
  }
}
