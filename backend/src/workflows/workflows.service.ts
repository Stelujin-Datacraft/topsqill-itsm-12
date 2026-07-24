import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { runWithConcurrency } from '../common/utils/concurrency.util';
import { SupabaseService } from '../supabase/supabase.service';
import { WorkflowExecutorService } from './workflow-executor.service';
import { WorkflowQueueService, QueueJob } from '../queue/workflow-queue.service';

interface QueueItem {
  id: string;
  workflow_id: string;
  submission_id?: string;
  trigger_data?: unknown;
}

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);
  private queueProcessing = false;
  private readonly queueBatchSize: number;
  private readonly queueConcurrency: number;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly workflowExecutor: WorkflowExecutorService,
    @Inject(forwardRef(() => WorkflowQueueService))
    private readonly workflowQueueService: WorkflowQueueService,
  ) {
    this.queueBatchSize = Number(this.configService.get('WORKFLOW_QUEUE_BATCH_SIZE', 20));
    this.queueConcurrency = Number(this.configService.get('WORKFLOW_QUEUE_CONCURRENCY', 10));
  }

  async enqueue(body: Record<string, unknown>) {
    const supabase = this.supabaseService.getServiceClient();
    const {
      workflow_id, submission_id, trigger_data, trigger_source,
      trigger_ref, priority, organization_id, project_id, skip_enrollment_check,
    } = body as Record<string, unknown>;

    if (!workflow_id) {
      return { success: false, error: 'workflow_id is required' };
    }

    const { data: workflow } = await supabase
      .from('workflows')
      .select('enrollment_mode, enrollment_cooldown_hours, status')
      .eq('id', workflow_id)
      .single();

    if (workflow?.status && workflow.status !== 'active') {
      return { success: false, enrollment_blocked: true, error: `Workflow is ${workflow.status}` };
    }

    if (!skip_enrollment_check && submission_id) {
      const enrollmentCheck = await this.checkEnrollment(
        workflow_id as string,
        submission_id as string,
        workflow,
      );
      if (!enrollmentCheck.allowed) {
        return {
          success: false,
          enrollment_blocked: true,
          enrollment_reason: enrollmentCheck.reason,
        };
      }
    }

    if (trigger_ref) {
      const { data: existing } = await supabase
        .from('workflow_queue')
        .select('id')
        .eq('workflow_id', workflow_id)
        .eq('trigger_ref', trigger_ref)
        .in('status', ['pending', 'processing'])
        .maybeSingle();

      if (existing) {
        return { success: true, deduplicated: true, queue_id: existing.id };
      }
    }

    const { data: queueItem, error } = await supabase
      .from('workflow_queue')
      .insert({
        workflow_id,
        submission_id,
        trigger_data,
        trigger_source: trigger_source || 'manual',
        trigger_ref,
        priority: priority || 5,
        organization_id,
        project_id,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };

    await this.workflowQueueService.enqueueJob({
      queueId: queueItem.id,
      workflowId: workflow_id as string,
      submissionId: submission_id as string | undefined,
      triggerData: trigger_data,
    });

    return { success: true, queue_id: queueItem.id };
  }

  processQueueAsync() {
    setImmediate(() => {
      this.processQueue().catch((err) => {
        this.logger.error('Workflow queue processing failed', err);
      });
    });
  }

  async processQueueItem(job: QueueJob) {
    const supabase = this.supabaseService.getServiceClient();
    try {
      const result = await this.executeWorkflow(
        job.workflowId,
        job.queueId,
        job.submissionId,
        job.triggerData,
      );
      await supabase
        .from('workflow_queue')
        .update({
          status: result.success ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          error_message: result.error,
        })
        .eq('id', job.queueId);
    } catch (err) {
      await supabase
        .from('workflow_queue')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : String(err),
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.queueId);
      throw err;
    }
  }

  async processQueue() {
    if (this.workflowQueueService.isRedisEnabled()) {
      return { success: true, skipped: true, reason: 'redis_worker_active' };
    }

    if (this.queueProcessing) {
      return { success: true, skipped: true, reason: 'already_processing' };
    }

    this.queueProcessing = true;
    const supabase = this.supabaseService.getServiceClient();

    try {
      const claimed = await this.claimPendingItems(supabase, this.queueBatchSize);
      if (!claimed.length) {
        return { success: true, processed: 0 };
      }

      let completed = 0;
      let failed = 0;

      await runWithConcurrency(claimed, this.queueConcurrency, async (item) => {
        try {
          await this.processQueueItem({
            queueId: item.id,
            workflowId: item.workflow_id,
            submissionId: item.submission_id,
            triggerData: item.trigger_data,
          });
          completed += 1;
        } catch {
          failed += 1;
        }
      });

      return { success: true, processed: claimed.length, completed, failed };
    } finally {
      this.queueProcessing = false;
    }
  }

  private async claimPendingItems(
    supabase: ReturnType<SupabaseService['getServiceClient']>,
    limit: number,
  ): Promise<QueueItem[]> {
    const { data: rpcClaimed, error: rpcError } = await supabase.rpc('claim_workflow_queue_batch', {
      batch_size: limit,
    });

    if (!rpcError && Array.isArray(rpcClaimed) && rpcClaimed.length) {
      return rpcClaimed as QueueItem[];
    }

    if (rpcError) {
      this.logger.warn(`claim_workflow_queue_batch RPC unavailable, using fallback claim: ${rpcError.message}`);
    }

    const { data: pending } = await supabase
      .from('workflow_queue')
      .select('id, workflow_id, submission_id, trigger_data')
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit);

    const claimed: QueueItem[] = [];

    for (const item of pending || []) {
      const { data: updated } = await supabase
        .from('workflow_queue')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('status', 'pending')
        .select('id, workflow_id, submission_id, trigger_data')
        .maybeSingle();

      if (updated) claimed.push(updated as QueueItem);
    }

    return claimed;
  }

  async executeWorkflow(
    workflowId: string,
    queueId?: string,
    submissionId?: string,
    triggerData?: unknown,
  ) {
    return this.workflowExecutor.runExecution(workflowId, submissionId, triggerData, queueId);
  }

  async resumeWaiting(body?: Record<string, unknown>) {
    const executionId = body?.execution_id as string | undefined;
    const { resumed } = await this.workflowExecutor.resumeWaiting(executionId);
    return { success: true, resumed };
  }

  private async checkEnrollment(workflowId: string, submissionId: string, workflow: any) {
    const supabase = this.supabaseService.getServiceClient();
    const { enrollment_mode, enrollment_cooldown_hours } = workflow || {};

    if (enrollment_mode === 'allow_always' || !enrollment_mode) {
      return { allowed: true };
    }

    const { data: existingExecutions } = await supabase
      .from('workflow_executions')
      .select('id, status, started_at, completed_at')
      .eq('workflow_id', workflowId)
      .eq('trigger_submission_id', submissionId)
      .in('status', ['completed', 'running', 'waiting'])
      .order('started_at', { ascending: false })
      .limit(1);

    if (!existingExecutions?.length) return { allowed: true };

    const lastExecution = existingExecutions[0];

    if (enrollment_mode === 'once_per_record') {
      return { allowed: false, reason: 'Record already enrolled in this workflow' };
    }

    if (enrollment_mode === 'cooldown') {
      const cooldownHours = enrollment_cooldown_hours || 24;
      const lastTime = new Date(lastExecution.completed_at || lastExecution.started_at).getTime();
      const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);
      if (hoursSince < cooldownHours) {
        return { allowed: false, reason: `Cooldown period active (${Math.ceil(cooldownHours - hoursSince)}h remaining)` };
      }
    }

    return { allowed: true };
  }

  async notifyFailure(body: { entity_type: string; entity_id: string; error: string; context?: unknown }) {
    const supabase = this.supabaseService.getServiceClient();
    const { entity_type, entity_id, error } = body;

    if (!entity_type || !entity_id || !['workflow', 'data_feed'].includes(entity_type)) {
      return { error: 'Invalid entity_type or entity_id' };
    }

    const table = entity_type === 'workflow' ? 'workflows' : 'data_feeds';
    const { data: entity } = await supabase
      .from(table)
      .select('id, name, notify_on_failure, organization_id, created_by')
      .eq('id', entity_id)
      .maybeSingle();

    if (!entity || entity.notify_on_failure === false) {
      return { skipped: entity ? 'notifications_disabled' : 'entity_not_found' };
    }

    const errorText = typeof error === 'string' ? error : JSON.stringify(error);
    const errorHash = createHash('sha256').update(errorText.slice(0, 500)).digest('hex').slice(0, 32);

    const { data: existing } = await supabase
      .from('failure_notifications')
      .select('occurrence_count')
      .eq('entity_type', entity_type)
      .eq('entity_id', entity_id)
      .eq('error_hash', errorHash)
      .maybeSingle();

    await supabase.from('failure_notifications').upsert({
      entity_type,
      entity_id,
      error_hash: errorHash,
      error_message: errorText.slice(0, 1000),
      last_notified_at: new Date().toISOString(),
      occurrence_count: (existing?.occurrence_count ?? 0) + 1,
    }, { onConflict: 'entity_type,entity_id,error_hash' });

    return { success: true, notified: true };
  }
}
