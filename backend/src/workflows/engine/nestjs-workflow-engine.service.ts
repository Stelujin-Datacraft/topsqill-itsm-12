import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { setEngineSupabase } from './port/workflow-db';
import { WorkflowOrchestrator } from './port/workflowOrchestrator';
import { SupabaseService } from '../../supabase/supabase.service';
import { EmailService } from '../../email/email.service';
import { WorkflowsService } from '../workflows.service';

export interface WorkflowTriggerPayload {
  formId?: string;
  submissionId?: string;
  submissionData?: Record<string, unknown>;
  submitterId?: string;
  formOwnerId?: string | null;
  startNodeId?: string;
  userEmail?: string;
  submitterName?: string;
  [key: string]: unknown;
}

const RESUME_BATCH_SIZE = 10;

@Injectable()
export class NestjsWorkflowEngineService {
  private readonly logger = new Logger(NestjsWorkflowEngineService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => WorkflowsService))
    private readonly workflowsService: WorkflowsService,
  ) {}

  private bindRuntime(supabase: SupabaseClient): void {
    setEngineSupabase(supabase, async (name, body) => this.invokeFunction(name, body || {}));
  }

  private async invokeFunction(name: string, body: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'send-template-email':
        return this.emailService.sendTemplateEmail(body);
      case 'notify-failure':
        return this.workflowsService.notifyFailure(body as {
          entity_type: string;
          entity_id: string;
          error: string;
          context?: unknown;
        });
      default:
        throw new Error(`Unsupported workflow function invoke: ${name}`);
    }
  }

  async executeExisting(
    workflowId: string,
    executionId: string,
    triggerData: WorkflowTriggerPayload,
    submissionId?: string,
    submitterId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.bindRuntime(this.supabaseService.getServiceClient());
    const supabase = this.supabaseService.getServiceClient();

    let startNodeId = triggerData.startNodeId as string | undefined;
    if (!startNodeId) {
      const formId = triggerData.formId as string | undefined;
      const { data: startNodes } = await supabase
        .from('workflow_nodes')
        .select('id, config')
        .eq('workflow_id', workflowId)
        .eq('node_type', 'start');

      if (formId && startNodes?.length) {
        const match = startNodes.find((n) => {
          const cfg = typeof n.config === 'string' ? JSON.parse(n.config) : n.config;
          return cfg?.triggerFormId === formId;
        });
        startNodeId = match?.id;
      }

      if (!startNodeId) {
        startNodeId = startNodes?.[0]?.id;
      }
    }

    if (!startNodeId) {
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          error_message: 'No start node found in workflow',
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionId);
      return { success: false, error: 'No start node found in workflow' };
    }

    await supabase
      .from('workflow_executions')
      .update({
        current_node_id: startNodeId,
        started_at: new Date().toISOString(),
      })
      .eq('id', executionId);

    const result = await WorkflowOrchestrator.continueFromNode(
      executionId,
      workflowId,
      startNodeId,
      triggerData,
      submissionId || (triggerData.submissionId as string | undefined),
      submitterId || (triggerData.submitterId as string | undefined),
    );

    return { success: result.success, error: result.error };
  }

  async resumeWaiting(executionId?: string): Promise<{ resumed: string[] }> {
    this.bindRuntime(this.supabaseService.getServiceClient());
    const supabase = this.supabaseService.getServiceClient();
    const now = new Date().toISOString();

    let query = supabase
      .from('workflow_executions')
      .select(
        'id, workflow_id, wait_node_id, wait_config, trigger_data, trigger_submission_id, submitter_id, current_node_id',
      )
      .eq('status', 'waiting');

    if (executionId) {
      query = query.eq('id', executionId);
    } else {
      query = query
        .lte('scheduled_resume_at', now)
        .order('scheduled_resume_at', { ascending: true })
        .limit(RESUME_BATCH_SIZE);
    }

    const { data: waiting, error } = await query;
    if (error || !waiting?.length) {
      return { resumed: [] };
    }

    const resumed: string[] = [];

    for (const execution of waiting) {
      const waitNodeId = execution.wait_node_id || execution.current_node_id;
      if (!waitNodeId) {
        await supabase
          .from('workflow_executions')
          .update({
            status: 'failed',
            error_message: 'Cannot resume: wait_node_id is missing',
            completed_at: now,
          })
          .eq('id', execution.id);
        continue;
      }

      const isConditionWaiting =
        (execution.wait_config as Record<string, unknown>)?.waitType === 'condition_waiting_for_value';

      await supabase
        .from('workflow_instance_logs')
        .update({
          status: 'completed',
          completed_at: now,
          output_data: {
            resumed: true,
            resumedAt: now,
            waitType: isConditionWaiting ? 'condition_waiting_for_value' : 'duration',
            message: 'Wait period completed, workflow resumed',
          },
        })
        .eq('execution_id', execution.id)
        .eq('node_id', waitNodeId)
        .in('status', ['waiting', 'running']);

      let nextNodeIds: string[] = [];

      if (isConditionWaiting) {
        nextNodeIds = [waitNodeId];
      } else {
        const { data: connections } = await supabase
          .from('workflow_connections')
          .select('target_node_id')
          .eq('source_node_id', waitNodeId);
        nextNodeIds = (connections || []).map((c: { target_node_id: string }) => c.target_node_id);
      }

      await supabase
        .from('workflow_executions')
        .update({
          status: 'running',
          scheduled_resume_at: null,
          wait_node_id: null,
          wait_config: null,
        })
        .eq('id', execution.id);

      if (!nextNodeIds.length) {
        await supabase
          .from('workflow_executions')
          .update({ status: 'completed', completed_at: now })
          .eq('id', execution.id);
        resumed.push(execution.id);
        continue;
      }

      const triggerData = (execution.trigger_data as Record<string, unknown>) || {};
      for (const nextNodeId of nextNodeIds) {
        await WorkflowOrchestrator.continueFromNode(
          execution.id,
          execution.workflow_id,
          nextNodeId,
          triggerData,
          execution.trigger_submission_id || undefined,
          execution.submitter_id || undefined,
        );
      }

      resumed.push(execution.id);
    }

    this.logger.log(`Resumed ${resumed.length} waiting workflow(s)`);
    return { resumed };
  }
}
