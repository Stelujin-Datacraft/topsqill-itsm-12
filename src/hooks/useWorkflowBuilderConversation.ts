/**
 * React hook for the conversational AI Workflow Builder session.
 */
import { useCallback, useRef, useState } from 'react';
import {
  shouldUseConversationalWorkflowBuilder,
  startWorkflowBuilderSession,
  continueWorkflowBuilderSession,
  type BuilderTurnResult,
  type DiscoveredForm,
  type DiscoveredWorkflow,
  type WorkflowBuilderSession,
} from '@/lib/ai/workflowBuilder';
import { compileWorkflowDefinition } from '@/lib/ai/workflowBuilder/nodeCompiler';

export function useWorkflowBuilderConversation() {
  const [session, setSession] = useState<WorkflowBuilderSession | null>(null);
  const sessionRef = useRef<WorkflowBuilderSession | null>(null);

  const clearBuilderSession = useCallback(() => {
    sessionRef.current = null;
    setSession(null);
  }, []);

  const isActive = Boolean(session && session.status !== 'cancelled' && session.status !== 'published');

  const maybeStartOrContinue = useCallback((params: {
    prompt: string;
    form?: DiscoveredForm;
    workflows?: DiscoveredWorkflow[];
    userId?: string;
    projectId?: string;
  }): BuilderTurnResult | null => {
    const active = sessionRef.current;
    const inFlight = active
      && active.status !== 'cancelled'
      && active.status !== 'published'
      && active.status !== 'ready_to_publish';

    // Continue existing session
    if (inFlight) {
      const result = continueWorkflowBuilderSession({
        session: active!,
        userMessage: params.prompt,
        form: params.form,
      });
      sessionRef.current = result.session;
      setSession(result.session);
      return result;
    }

    // Start only for approval-style intents
    if (!shouldUseConversationalWorkflowBuilder(params.prompt)) {
      return null;
    }

    const result = startWorkflowBuilderSession({
      prompt: params.prompt,
      form: params.form,
      workflows: params.workflows,
      userId: params.userId,
      projectId: params.projectId,
    });
    sessionRef.current = result.session;
    setSession(result.session);
    return result;
  }, []);

  const getBuilderSession = useCallback(() => sessionRef.current, []);

  const updateBuilderSession = useCallback((next: WorkflowBuilderSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const getCompiledForPublish = useCallback(() => {
    const active = sessionRef.current;
    if (!active || active.status !== 'ready_to_publish') return null;
    if (active.compiledNodes?.length) {
      return {
        name: active.requirements.name,
        description: active.requirements.description || active.requirements.name,
        triggerFormId: active.requirements.trigger.formId,
        nodes: active.compiledNodes,
      };
    }
    return compileWorkflowDefinition(active.requirements);
  }, []);

  const markPublished = useCallback(() => {
    if (!sessionRef.current) return;
    const next = {
      ...sessionRef.current,
      status: 'published' as const,
      updatedAt: new Date().toISOString(),
    };
    sessionRef.current = next;
    setSession(next);
  }, []);

  return {
    builderSession: session,
    isBuilderActive: isActive,
    maybeStartOrContinue,
    clearBuilderSession,
    getBuilderSession,
    updateBuilderSession,
    getCompiledForPublish,
    markPublished,
    shouldUseConversationalWorkflowBuilder,
  };
}
