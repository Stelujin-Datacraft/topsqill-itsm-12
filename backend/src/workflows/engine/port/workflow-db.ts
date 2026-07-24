// @ts-nocheck
import { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let functionInvoker: ((name: string, body?: Record<string, unknown>) => Promise<unknown>) | null = null;

export function setEngineSupabase(
  supabase: SupabaseClient,
  invoke?: (name: string, body?: Record<string, unknown>) => Promise<unknown>,
): void {
  client = supabase;
  functionInvoker = invoke || null;
}

export function engineDb() {
  if (!client) throw new Error('Workflow engine DB not initialized');
  return {
    from: (...args: Parameters<SupabaseClient['from']>) => client!.from(...args),
    rpc: (...args: Parameters<SupabaseClient['rpc']>) => client!.rpc(...args),
    functions: {
      invoke: async (name: string, options?: { body?: Record<string, unknown> }) => {
        if (!functionInvoker) {
          throw new Error(`Function invoke not configured: ${name}`);
        }
        try {
          const data = await functionInvoker(name, options?.body);
          return { data, error: null };
        } catch (err) {
          return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
        }
      },
    },
  };
}
