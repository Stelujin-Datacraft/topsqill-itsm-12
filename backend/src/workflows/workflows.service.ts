import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class WorkflowsService {
  constructor(private readonly supabaseService: SupabaseService) {}

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

    this.processQueueAsync();

    return { success: true, queue_id: queueItem.id };
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

  private processQueueAsync() {
    setImmediate(() => this.processQueue().catch(console.error));
  }

  async processQueue() {
    const supabase = this.supabaseService.getServiceClient();
    const { data: pending } = await supabase
      .from('workflow_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(5);

    for (const item of pending || []) {
      await supabase.from('workflow_queue').update({ status: 'processing' }).eq('id', item.id);
      try {
        await this.executeWorkflow(item.workflow_id, item.id, item.submission_id, item.trigger_data);
        await supabase.from('workflow_queue').update({ status: 'completed' }).eq('id', item.id);
      } catch (err) {
        await supabase.from('workflow_queue').update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : String(err),
        }).eq('id', item.id);
      }
    }
  }

  async executeWorkflow(workflowId: string, queueId?: string, submissionId?: string, triggerData?: unknown) {
    const supabase = this.supabaseService.getServiceClient();

    const { data: execution, error } = await supabase
      .from('workflow_executions')
      .insert({
        workflow_id: workflowId,
        trigger_submission_id: submissionId,
        trigger_data: triggerData,
        status: 'running',
        queue_id: queueId,
      })
      .select('id')
      .single();

    if (error) throw error;

    const { data: nodes } = await supabase
      .from('workflow_nodes')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('execution_order', { ascending: true });

    for (const node of nodes || []) {
      await supabase.from('workflow_node_executions').insert({
        execution_id: execution.id,
        node_id: node.id,
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
    }

    await supabase
      .from('workflow_executions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', execution.id);

    return { success: true, execution_id: execution.id };
  }

  async resumeWaiting(body?: Record<string, unknown>) {
    const supabase = this.supabaseService.getServiceClient();
    const executionId = body?.execution_id as string | undefined;

    let query = supabase
      .from('workflow_executions')
      .select('*')
      .eq('status', 'waiting');

    if (executionId) query = query.eq('id', executionId);

    const { data: waiting } = await query.limit(10);
    const resumed: string[] = [];

    for (const exec of waiting || []) {
      await supabase
        .from('workflow_executions')
        .update({ status: 'running' })
        .eq('id', exec.id);
      resumed.push(exec.id);
    }

    return { success: true, resumed };
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

    await supabase.from('failure_notifications').upsert({
      entity_type,
      entity_id,
      error_hash: errorHash,
      error_message: errorText.slice(0, 1000),
      last_notified_at: new Date().toISOString(),
      occurrence_count: 1,
    }, { onConflict: 'entity_type,entity_id,error_hash' });

    return { success: true, notified: true };
  }
}
