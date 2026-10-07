import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Environment-specific Supabase client configuration.
 * Dev and Prod must each supply their own project URL + anon key.
 * There is intentionally NO hardcoded project fallback — missing env fails loudly
 * so a Production build cannot silently connect to Development.
 */

function requiredViteEnv(primary: string, ...aliases: string[]): string {
  const keys = [primary, ...aliases];
  for (const key of keys) {
    const value = import.meta.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  const tried = keys.join(' or ');
  throw new Error(
    `Missing required Supabase environment variable (${tried}). `
      + 'Set it for this deployment (Development vs Production use different Supabase projects). '
      + 'See .env.example.',
  );
}

export const SUPABASE_URL = requiredViteEnv('VITE_SUPABASE_URL');

/** Client-side anon / publishable key (never the service_role key). */
export const SUPABASE_ANON_KEY = requiredViteEnv(
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
);

/** @deprecated Prefer SUPABASE_ANON_KEY — kept for existing imports. */
export const SUPABASE_PUBLISHABLE_KEY = SUPABASE_ANON_KEY;

/** Raw Supabase client — used only for auth, storage, and realtime. */
export const rawSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
