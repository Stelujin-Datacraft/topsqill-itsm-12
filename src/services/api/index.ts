/**
 * Unified backend client — use this for all database and API operations.
 * Auth, Realtime, and Storage still use Supabase directly via rawClient.
 */
export { api, getApiBaseUrl, getPublicApiUrl, getFormApiUrl, getPolicyPreviewUrl, request, clearAuthTokenCache } from './apiClient';
export { db, paginatedRange } from './databaseClient';

import { rawSupabase } from '@/integrations/supabase/rawClient';
import { api } from './apiClient';
import { db } from './databaseClient';

/** Backend client: NestJS API for data/functions, Supabase for auth/realtime/storage */
export const backend = {
  auth: rawSupabase.auth,
  from: db.from.bind(db),
  rpc: db.rpc.bind(db),
  functions: {
    invoke: api.invoke.bind(api),
  },
  channel: rawSupabase.channel.bind(rawSupabase),
  removeChannel: rawSupabase.removeChannel.bind(rawSupabase),
  storage: rawSupabase.storage,
};

import { initWorkflowDb } from '@/services/workflow/db';

initWorkflowDb({
  from: backend.from.bind(backend),
  rpc: backend.rpc.bind(backend),
  functions: backend.functions,
});

export default backend;
