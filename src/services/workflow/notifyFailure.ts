import { supabase } from '@/integrations/supabase/client';

/**
 * Notify admins when a workflow fails. Fire-and-forget — failures here
 * must never disrupt the workflow execution path. Deduplication, cooldown,
 * and the per-workflow toggle are enforced by the notify-failure edge function.
 */
export async function notifyWorkflowFailure(
  workflowId: string,
  errorMessage: string | undefined | null,
  context: Record<string, any> = {}
): Promise<void> {
  if (!workflowId) return;
  try {
    await supabase.functions.invoke('notify-failure', {
      body: {
        entity_type: 'workflow',
        entity_id: workflowId,
        error: errorMessage || 'Workflow execution failed',
        context,
      },
    });
  } catch (err) {
    console.error('notifyWorkflowFailure: invoke failed', err);
  }
}