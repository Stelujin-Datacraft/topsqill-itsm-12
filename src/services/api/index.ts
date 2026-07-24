/**
 * Unified backend client — use this instead of direct Supabase database/edge function calls.
 */
export { api, getApiBaseUrl, getPublicApiUrl, getFormApiUrl, request } from './apiClient';
export { db } from './databaseClient';

import { supabase } from '@/integrations/supabase/client';
import { api } from './apiClient';
import { db } from './databaseClient';

/** Backend client with auth, database, and function invocation */
export const backend = {
  /** Supabase Auth — still used for login/session management */
  auth: supabase.auth,

  /** Database operations via NestJS API */
  from: db.from.bind(db),
  rpc: db.rpc.bind(db),

  /** Edge function replacements via NestJS API */
  functions: {
    invoke: api.invoke.bind(api),
  },

  /** Realtime — still uses Supabase directly */
  channel: supabase.channel.bind(supabase),
  removeChannel: supabase.removeChannel.bind(supabase),

  /** Storage — still uses Supabase directly */
  storage: supabase.storage,
};

export default backend;
