/**
 * @deprecated VIS no longer uses Prisma at runtime.
 * Persistence is Supabase (`vis_documents` / `vis_secret_blobs`) via
 * `vis-supabase-client.ts` / `supabase-vis.store.ts`.
 *
 * This stub remains so legacy imports fail clearly instead of requiring
 * VIS_DATABASE_URL or a generated Prisma client at Nest boot.
 */

export function getVisPrisma(): never {
  throw new Error(
    'Prisma VIS persistence has been removed. '
      + 'Use Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) with VIS_PERSISTENCE=supabase.',
  );
}

export async function disconnectVisPrisma(): Promise<void> {
  /* no-op */
}

/** @deprecated Use isVisSupabasePersistenceEnabled */
export function isPrismaPersistenceEnabled(): boolean {
  const { isVisSupabasePersistenceEnabled } = require('./vis-supabase-client') as typeof import('./vis-supabase-client');
  return isVisSupabasePersistenceEnabled();
}

export type PrismaClient = never;
