import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { NestjsWorkflowEngineService } from './engine/nestjs-workflow-engine.service';

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

@Injectable()
export class WorkflowExecutorService {
  private readonly logger = new Logger(WorkflowExecutorService.name);
  private readonly supabaseUrl: string;
  private readonly serviceKey: string;
  private readonly executorMode: string;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly nestjsEngine: NestjsWorkflowEngineService,
  ) {
    this.supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    this.serviceKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.executorMode = this.configService.get<string>('WORKFLOW_EXECUTOR_MODE', 'nestjs');
  }

  async runExecution(
    workflowId: string,
    submissionId: string | undefined,
    triggerData: WorkflowTriggerPayload | unknown,
    queueId?: string,
  ): Promise<{ execution_id: string; success: boolean; error?: string }> {
    const payload = (triggerData || {}) as WorkflowTriggerPayload;
    const supabase = this.supabaseService.getServiceClient();

    const { data: execution, error } = await supabase
      .from('workflow_executions')
      .insert({
        workflow_id: workflowId,
        form_submission_id: submissionId || payload.submissionId,
        trigger_submission_id: submissionId || payload.submissionId,
        submitter_id: payload.submitterId,
        form_owner_id: payload.formOwnerId,
        trigger_form_id: payload.formId,
        trigger_data: payload,
        status: 'running',
        started_at: new Date().toISOString(),
        current_node_id: payload.startNodeId,
      })
      .select('id')
      .single();

    if (error || !execution) {
      throw new Error(error?.message || 'Failed to create workflow execution');
    }

    if (queueId) {
      await supabase
        .from('workflow_queue')
        .update({ execution_id: execution.id })
        .eq('id', queueId);
    }

    try {
      if (this.executorMode === 'edge') {
        await this.invokeEdgeFunction('execute-workflow', {
          workflowId,
          executionId: execution.id,
          triggerData: payload,
          submissionId: submissionId || payload.submissionId,
          submitterId: payload.submitterId,
        });
      } else {
        const result = await this.nestjsEngine.executeExisting(
          workflowId,
          execution.id,
          payload,
          submissionId || payload.submissionId,
          payload.submitterId,
        );
        if (!result.success) {
          const { data: current } = await supabase
            .from('workflow_executions')
            .select('status')
            .eq('id', execution.id)
            .single();
          if (current?.status === 'running') {
            await supabase
              .from('workflow_executions')
              .update({
                status: 'failed',
                error_message: (result.error || 'Workflow execution failed').slice(0, 1000),
                completed_at: new Date().toISOString(),
              })
              .eq('id', execution.id);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Workflow execution failed for ${execution.id}: ${message}`);
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          error_message: message.slice(0, 1000),
          completed_at: new Date().toISOString(),
        })
        .eq('id', execution.id);
    }

    const { data: finalExecution } = await supabase
      .from('workflow_executions')
      .select('status, error_message')
      .eq('id', execution.id)
      .single();

    const success = finalExecution?.status === 'completed' || finalExecution?.status === 'waiting';

    return {
      execution_id: execution.id,
      success,
      error: success ? undefined : finalExecution?.error_message || 'Workflow execution failed',
    };
  }

  async resumeWaiting(executionId?: string): Promise<{ resumed: string[] }> {
    if (this.executorMode === 'edge') {
      const result = await this.invokeEdgeFunction('resume-waiting-workflows', {
        execution_id: executionId,
      });
      return { resumed: (result?.resumed as string[]) || (result?.resumedExecutions as string[]) || [] };
    }

    return this.nestjsEngine.resumeWaiting(executionId);
  }

  private async invokeEdgeFunction(
    functionName: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const url = `${this.supabaseUrl}/functions/v1/${functionName}`;
    const timeoutMs = Number(this.configService.get('EDGE_FUNCTION_TIMEOUT_MS', 120000));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.serviceKey}`,
          apikey: this.serviceKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      let data: Record<string, unknown> | null = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        const message = (data?.error as string) || (data?.message as string) || text || response.statusText;
        throw new Error(`${functionName} failed (${response.status}): ${message}`);
      }

      return data;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`${functionName} timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
