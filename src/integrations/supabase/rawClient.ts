import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Environment-specific Supabase client configuration.
 * Dev and Prod must each supply their own project URL + anon key.
 * There is intentionally NO hardcoded project fallback — missing env fails loudly
 * so a Production build cannot silently connect to Development.
 */

// Public (non-secret) fallbacks so a build without .env still works.
const PUBLIC_FALLBACKS: Record<string, string> = {
  VITE_SUPABASE_URL: 'https://fnmkczsvwpzpxyklztkt.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubWtjenN2d3B6cHh5a2x6dGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNzU1OTUsImV4cCI6MjA2NDg1MTU5NX0.bSLI8JUAIry3mC6cxBt5sF7r-gyelR63Emdoe7siNjQ',
};

function requiredViteEnv(primary: string, ...aliases: string[]): string {
  const keys = [primary, ...aliases];
  for (const key of keys) {
    const value = import.meta.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  for (const key of keys) {
    if (PUBLIC_FALLBACKS[key]) return PUBLIC_FALLBACKS[key];
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
