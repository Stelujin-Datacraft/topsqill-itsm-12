/**
 * Server-only Supabase client for VIS persistence.
 * Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (never VITE_* / anon in production writes).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function isVisSupabasePersistenceEnabled(): boolean {
  if (process.env.VIS_PERSISTENCE === 'file' || process.env.VIS_PERSISTENCE === 'memory') return false;
  // Explicit durable flags (legacy `prisma` routes to Supabase)
  if (process.env.VIS_PERSISTENCE === 'supabase' || process.env.VIS_PERSISTENCE === 'prisma') return true;
  // Legacy separate VIS DB URL still means "want durable"
  if (process.env.VIS_DATABASE_URL) return true;
  // Production defaults to shared Supabase when credentials exist.
  // Development does NOT auto-enable durable mode merely because Nest has SUPABASE_*
  // (those credentials are shared with the rest of the app / local .env).
  if (process.env.NODE_ENV === 'production') {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return false;
}

export function getVisSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for VIS Supabase persistence. '
        + 'VIS no longer uses a separate VIS_DATABASE_URL / Prisma connection.',
    );
  }

  // Soft check: service role JWT should claim role=service_role
  try {
    const payload = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64url').toString('utf8'));
    if (payload?.role && payload.role !== 'service_role') {
      console.warn(
        `[VIS] SUPABASE_SERVICE_ROLE_KEY JWT role is "${payload.role}" (expected service_role). `
          + 'Durable VIS writes may fail under RLS.',
      );
    }
  } catch {
    /* non-JWT left as-is */
  }

  client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

export function resetVisSupabaseClientForTests() {
  client = null;
}
