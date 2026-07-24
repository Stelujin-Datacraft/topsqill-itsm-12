import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://fnmkczsvwpzpxyklztkt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubWtjenN2d3B6cHh5a2x6dGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNzU1OTUsImV4cCI6MjA2NDg1MTU5NX0.bSLI8JUAIry3mC6cxBt5sF7r-gyelR63Emdoe7siNjQ';

/** Raw Supabase client — used only for auth, storage, and realtime. */
export const rawSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
