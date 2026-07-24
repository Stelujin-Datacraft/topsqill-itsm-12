/**
 * Workflow database client — initialized once per runtime (browser or NestJS).
 * Keeps workflow execution logic shared between frontend and backend.
 */
export interface WorkflowFunctionInvoke {
  (name: string, options?: { body?: Record<string, unknown> }): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

export interface WorkflowDbClient {
  from: (table: string) => ReturnType<import('@supabase/supabase-js').SupabaseClient['from']>;
  rpc: (fn: string, params?: Record<string, unknown>) => ReturnType<import('@supabase/supabase-js').SupabaseClient['rpc']>;
  functions: { invoke: WorkflowFunctionInvoke };
}

let client: WorkflowDbClient | null = null;

export function initWorkflowDb(db: WorkflowDbClient): void {
  client = db;
}

export function workflowDb(): WorkflowDbClient {
  if (!client) {
    throw new Error('Workflow DB not initialized — call initWorkflowDb() at app startup');
  }
  return client;
}
