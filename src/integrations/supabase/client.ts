import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { db } from '@/services/api/databaseClient';
import { api } from '@/services/api/apiClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://fnmkczsvwpzpxyklztkt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubWtjenN2d3B6cHh5a2x6dGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNzU1OTUsImV4cCI6MjA2NDg1MTU5NX0.bSLI8JUAIry3mC6cxBt5sF7r-gyelR63Emdoe7siNjQ";

const rawClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * When VITE_USE_BACKEND_API is enabled (default), database queries and edge
 * function calls are routed through the NestJS backend API. Auth, Realtime,
 * and Storage continue to use Supabase directly.
 */
const USE_BACKEND_API = import.meta.env.VITE_USE_BACKEND_API !== 'false';

function createBackendProxy(client: SupabaseClient<Database>): SupabaseClient<Database> {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return db.from.bind(db);
      }
      if (prop === 'rpc') {
        return db.rpc.bind(db);
      }
      if (prop === 'functions') {
        return { invoke: api.invoke.bind(api) };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
  }) as SupabaseClient<Database>;
}

export const supabase = USE_BACKEND_API
  ? createBackendProxy(rawClient)
  : rawClient;

export { SUPABASE_URL };
